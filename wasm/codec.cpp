#include "bc7decomp.h"
#include "bc7enc.h"
#include "rgbcx.h"

#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <limits>

namespace {

enum class bc_format : uint32_t { bc1 = 1, bc2 = 2, bc3 = 3, bc4 = 4, bc5 = 5, bc7 = 7 };

constexpr uint32_t progress_chunk_blocks = 1024;
constexpr uint32_t encode_flag_perceptual = 1;

extern "C" __attribute__((import_module("env"), import_name("report_progress")))
void report_progress(uint32_t completed, uint32_t total);

uint32_t block_size(bc_format format) {
    switch (format) {
        case bc_format::bc1:
        case bc_format::bc4:
            return 8;
        case bc_format::bc2:
        case bc_format::bc3:
        case bc_format::bc5:
        case bc_format::bc7:
            return 16;
    }
    return 0;
}

bool buffer_sizes(
    bc_format format,
    uint32_t width,
    uint32_t height,
    uint32_t& compressed_size,
    uint32_t& rgba_size,
    uint32_t& total_blocks
) {
    const uint32_t bytes_per_block = block_size(format);
    if (bytes_per_block == 0 || width == 0 || height == 0) return false;

    const uint64_t blocks_width = (static_cast<uint64_t>(width) + 3) / 4;
    const uint64_t blocks_height = (static_cast<uint64_t>(height) + 3) / 4;
    const uint64_t blocks = blocks_width * blocks_height;
    const uint64_t compressed = blocks * bytes_per_block;
    const uint64_t rgba = static_cast<uint64_t>(width) * height * 4;

    if (blocks > UINT32_MAX || compressed > UINT32_MAX || rgba > UINT32_MAX) return false;
    compressed_size = static_cast<uint32_t>(compressed);
    rgba_size = static_cast<uint32_t>(rgba);
    total_blocks = static_cast<uint32_t>(blocks);
    return true;
}

uint8_t expand5(uint16_t value) {
    return static_cast<uint8_t>((value << 3) | (value >> 2));
}

uint8_t expand6(uint16_t value) {
    return static_cast<uint8_t>((value << 2) | (value >> 4));
}

void decode_bc1_colors(const uint8_t* block, uint8_t* pixels, bool force_four_colors) {
    const uint16_t endpoint0 = static_cast<uint16_t>(block[0] | (block[1] << 8));
    const uint16_t endpoint1 = static_cast<uint16_t>(block[2] | (block[3] << 8));
    const uint32_t selectors = static_cast<uint32_t>(block[4]) |
        (static_cast<uint32_t>(block[5]) << 8) |
        (static_cast<uint32_t>(block[6]) << 16) |
        (static_cast<uint32_t>(block[7]) << 24);

    uint8_t palette[4][4] = {};
    palette[0][0] = expand5(endpoint0 >> 11);
    palette[0][1] = expand6((endpoint0 >> 5) & 0x3f);
    palette[0][2] = expand5(endpoint0 & 0x1f);
    palette[0][3] = 255;
    palette[1][0] = expand5(endpoint1 >> 11);
    palette[1][1] = expand6((endpoint1 >> 5) & 0x3f);
    palette[1][2] = expand5(endpoint1 & 0x1f);
    palette[1][3] = 255;

    if (force_four_colors || endpoint0 > endpoint1) {
        for (uint32_t channel = 0; channel < 3; ++channel) {
            palette[2][channel] = static_cast<uint8_t>((2 * palette[0][channel] + palette[1][channel]) / 3);
            palette[3][channel] = static_cast<uint8_t>((palette[0][channel] + 2 * palette[1][channel]) / 3);
        }
        palette[2][3] = 255;
        palette[3][3] = 255;
    } else {
        for (uint32_t channel = 0; channel < 3; ++channel) {
            palette[2][channel] = static_cast<uint8_t>((palette[0][channel] + palette[1][channel]) / 2);
        }
        palette[2][3] = 255;
    }

    for (uint32_t pixel = 0; pixel < 16; ++pixel) {
        const uint32_t selector = (selectors >> (pixel * 2)) & 3;
        std::memcpy(pixels + pixel * 4, palette[selector], 4);
    }
}

void decode_bc2(const uint8_t* block, uint8_t* pixels) {
    decode_bc1_colors(block + 8, pixels, true);
    for (uint32_t pixel = 0; pixel < 16; ++pixel) {
        const uint8_t packed = block[pixel / 2];
        const uint8_t alpha = (pixel & 1) == 0 ? packed & 0xf : packed >> 4;
        pixels[pixel * 4 + 3] = static_cast<uint8_t>(alpha * 17);
    }
}

uint16_t pack_565(const uint8_t* color) {
    return static_cast<uint16_t>(((color[0] * 31 + 127) / 255) << 11 |
        ((color[1] * 63 + 127) / 255) << 5 |
        ((color[2] * 31 + 127) / 255));
}

uint32_t color_distance(const uint8_t* first, const uint8_t* second) {
    const int red = static_cast<int>(first[0]) - second[0];
    const int green = static_cast<int>(first[1]) - second[1];
    const int blue = static_cast<int>(first[2]) - second[2];
    return static_cast<uint32_t>(red * red + green * green + blue * blue);
}

void encode_bc1_with_alpha(uint8_t* block, const uint8_t* pixels) {
    uint8_t minimum[3] = {255, 255, 255};
    uint8_t maximum[3] = {0, 0, 0};
    bool has_opaque = false;
    for (uint32_t pixel = 0; pixel < 16; ++pixel) {
        const uint8_t* color = pixels + pixel * 4;
        if (color[3] < 128) continue;
        has_opaque = true;
        for (uint32_t channel = 0; channel < 3; ++channel) {
            minimum[channel] = std::min(minimum[channel], color[channel]);
            maximum[channel] = std::max(maximum[channel], color[channel]);
        }
    }

    uint16_t endpoint0 = has_opaque ? pack_565(minimum) : 0;
    uint16_t endpoint1 = has_opaque ? pack_565(maximum) : 0;
    if (endpoint0 > endpoint1) std::swap(endpoint0, endpoint1);
    block[0] = static_cast<uint8_t>(endpoint0);
    block[1] = static_cast<uint8_t>(endpoint0 >> 8);
    block[2] = static_cast<uint8_t>(endpoint1);
    block[3] = static_cast<uint8_t>(endpoint1 >> 8);

    uint8_t palette[64] = {};
    // Select palette entries 0, 1, and 2 for the first three temporary pixels.
    block[4] = 0x24;
    block[5] = 0;
    block[6] = 0;
    block[7] = 0;
    decode_bc1_colors(block, palette, false);
    uint32_t selectors = 0;
    for (uint32_t pixel = 0; pixel < 16; ++pixel) {
        const uint8_t* color = pixels + pixel * 4;
        uint32_t best_selector = 3;
        if (color[3] >= 128) {
            uint32_t best_distance = UINT32_MAX;
            for (uint32_t selector = 0; selector < 3; ++selector) {
                const uint32_t distance = color_distance(color, palette + selector * 4);
                if (distance < best_distance) {
                    best_distance = distance;
                    best_selector = selector;
                }
            }
        }
        selectors |= best_selector << (pixel * 2);
    }
    block[4] = static_cast<uint8_t>(selectors);
    block[5] = static_cast<uint8_t>(selectors >> 8);
    block[6] = static_cast<uint8_t>(selectors >> 16);
    block[7] = static_cast<uint8_t>(selectors >> 24);
}

bool decode_block(bc_format format, const uint8_t* block, uint8_t* pixels) {
    std::memset(pixels, 0, 64);
    switch (format) {
        case bc_format::bc1:
            rgbcx::unpack_bc1(block, pixels);
            return true;
        case bc_format::bc2:
            decode_bc2(block, pixels);
            return true;
        case bc_format::bc3:
            rgbcx::unpack_bc3(block, pixels);
            return true;
        case bc_format::bc4:
            for (uint32_t pixel = 0; pixel < 16; ++pixel) pixels[pixel * 4 + 3] = 255;
            rgbcx::unpack_bc4(block, pixels, 4);
            return true;
        case bc_format::bc5:
            for (uint32_t pixel = 0; pixel < 16; ++pixel) pixels[pixel * 4 + 3] = 255;
            rgbcx::unpack_bc5(block, pixels, 0, 1, 4);
            return true;
        case bc_format::bc7:
            return bc7decomp::unpack_bc7(block, reinterpret_cast<bc7decomp::color_rgba*>(pixels));
    }
    return false;
}

void encode_block(bc_format format, const uint8_t* pixels, uint8_t* block, uint32_t quality, uint32_t flags) {
    switch (format) {
        case bc_format::bc1: {
            bool has_transparency = false;
            for (uint32_t pixel = 0; pixel < 16; ++pixel) has_transparency |= pixels[pixel * 4 + 3] < 128;
            if (has_transparency) encode_bc1_with_alpha(block, pixels);
            else rgbcx::encode_bc1(quality, block, pixels, true, false);
            return;
        }
        case bc_format::bc2:
            for (uint32_t pixel = 0; pixel < 16; pixel += 2) {
                const uint8_t alpha0 = static_cast<uint8_t>((pixels[pixel * 4 + 3] + 8) / 17);
                const uint8_t alpha1 = static_cast<uint8_t>((pixels[(pixel + 1) * 4 + 3] + 8) / 17);
                block[pixel / 2] = static_cast<uint8_t>(alpha0 | (alpha1 << 4));
            }
            rgbcx::encode_bc1(quality, block + 8, pixels, false, false);
            return;
        case bc_format::bc3:
            rgbcx::encode_bc3(quality, block, pixels);
            return;
        case bc_format::bc4:
            if (quality >= 9) rgbcx::encode_bc4_hq(block, pixels);
            else rgbcx::encode_bc4(block, pixels);
            return;
        case bc_format::bc5:
            if (quality >= 9) rgbcx::encode_bc5_hq(block, pixels);
            else rgbcx::encode_bc5(block, pixels);
            return;
        case bc_format::bc7: {
            bc7enc_compress_block_params params;
            bc7enc_compress_block_params_init(&params);
            params.m_max_partitions = quality == 0 ? 0 : std::max(1u, quality * 64 / 18);
            params.m_uber_level = quality >= 15 ? quality - 14 : 0;
            if ((flags & encode_flag_perceptual) == 0) bc7enc_compress_block_params_init_linear_weights(&params);
            bc7enc_compress_block(block, pixels, &params);
            return;
        }
    }
}

void copy_decoded_block(const uint8_t* block, uint8_t* output, uint32_t width, uint32_t height, uint32_t block_x, uint32_t block_y) {
    const uint32_t pixel_x = block_x * 4;
    const uint32_t pixel_y = block_y * 4;
    const uint32_t copy_width = std::min(4u, width - pixel_x);
    const uint32_t copy_height = std::min(4u, height - pixel_y);
    for (uint32_t row = 0; row < copy_height; ++row) {
        std::memcpy(output + (static_cast<uint64_t>(pixel_y + row) * width + pixel_x) * 4,
            block + row * 16, copy_width * 4);
    }
}

void gather_source_block(const uint8_t* input, uint8_t* block, uint32_t width, uint32_t height, uint32_t block_x, uint32_t block_y) {
    for (uint32_t row = 0; row < 4; ++row) {
        const uint32_t source_y = std::min(block_y * 4 + row, height - 1);
        for (uint32_t column = 0; column < 4; ++column) {
            const uint32_t source_x = std::min(block_x * 4 + column, width - 1);
            std::memcpy(block + (row * 4 + column) * 4,
                input + (static_cast<uint64_t>(source_y) * width + source_x) * 4, 4);
        }
    }
}

} // namespace

extern "C" {

void* codec_allocate(uint32_t length) {
    return length == 0 ? nullptr : std::malloc(length);
}

void codec_deallocate(void* pointer) {
    std::free(pointer);
}

void codec_initialize() {
    rgbcx::init(rgbcx::bc1_approx_mode::cBC1Ideal);
    bc7enc_compress_block_init();
}

uint32_t codec_decode(uint32_t format_value, const uint8_t* input, uint32_t input_length,
    uint8_t* output, uint32_t output_length, uint32_t width, uint32_t height) {
    const auto format = static_cast<bc_format>(format_value);
    uint32_t expected_input = 0, expected_output = 0, total_blocks = 0;
    if (input == nullptr || output == nullptr ||
        !buffer_sizes(format, width, height, expected_input, expected_output, total_blocks) ||
        input_length != expected_input || output_length != expected_output) return 1;

    const uint32_t blocks_width = (width + 3) / 4;
    const uint32_t bytes_per_block = block_size(format);
    report_progress(0, total_blocks);
    for (uint32_t block_index = 0; block_index < total_blocks; ++block_index) {
        uint8_t decoded[64];
        if (!decode_block(format, input + block_index * bytes_per_block, decoded)) return 2;
        copy_decoded_block(decoded, output, width, height, block_index % blocks_width, block_index / blocks_width);
        if ((block_index + 1) % progress_chunk_blocks == 0 || block_index + 1 == total_blocks)
            report_progress(block_index + 1, total_blocks);
    }
    return 0;
}

uint32_t codec_encode(uint32_t format_value, const uint8_t* input, uint32_t input_length,
    uint8_t* output, uint32_t output_length, uint32_t width, uint32_t height,
    uint32_t quality, uint32_t flags) {
    const auto format = static_cast<bc_format>(format_value);
    uint32_t expected_output = 0, expected_input = 0, total_blocks = 0;
    if (input == nullptr || output == nullptr || quality > rgbcx::MAX_LEVEL ||
        !buffer_sizes(format, width, height, expected_output, expected_input, total_blocks) ||
        input_length != expected_input || output_length != expected_output) return 1;

    const uint32_t blocks_width = (width + 3) / 4;
    const uint32_t bytes_per_block = block_size(format);
    report_progress(0, total_blocks);
    for (uint32_t block_index = 0; block_index < total_blocks; ++block_index) {
        uint8_t source[64];
        gather_source_block(input, source, width, height, block_index % blocks_width, block_index / blocks_width);
        encode_block(format, source, output + block_index * bytes_per_block, quality, flags);
        if ((block_index + 1) % progress_chunk_blocks == 0 || block_index + 1 == total_blocks)
            report_progress(block_index + 1, total_blocks);
    }
    return 0;
}

} // extern "C"
