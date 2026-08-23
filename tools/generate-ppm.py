import argparse
from pathlib import Path


BLOCK_SIZE = 4
RGB565_COLOR_COUNT = 1 << 16  # 65,536


def is_power_of_two(value: int) -> bool:
    return value > 0 and (value & (value - 1)) == 0


def expand_5_to_8(value: int) -> int:
    """
    Expand a 5-bit value to 8 bits using bit replication.

    abcde -> abcdeabc
    """
    return (value << 3) | (value >> 2)


def expand_6_to_8(value: int) -> int:
    """
    Expand a 6-bit value to 8 bits using bit replication.

    abcdef -> abcdefab
    """
    return (value << 2) | (value >> 4)


def rgb565_to_rgb888(color: int) -> tuple[int, int, int]:
    """
    Convert a 16-bit RGB565 color to 24-bit RGB.

    RGB565 layout:
        RRRRR GGGGGG BBBBB
    """
    red_5 = (color >> 11) & 0x1F
    green_6 = (color >> 5) & 0x3F
    blue_5 = color & 0x1F

    return (
        expand_5_to_8(red_5),
        expand_6_to_8(green_6),
        expand_5_to_8(blue_5),
    )


def generate_ppm(
    output_path: Path,
    width: int,
    height: int,
    block_size: int = BLOCK_SIZE,
) -> None:
    if not is_power_of_two(width):
        raise ValueError(f"Width must be a power of two; got {width}")

    if not is_power_of_two(height):
        raise ValueError(f"Height must be a power of two; got {height}")

    if width % block_size != 0 or height % block_size != 0:
        raise ValueError(
            f"Width and height must be divisible by the block size "
            f"({block_size}); got {width}x{height}"
        )

    blocks_x = width // block_size
    blocks_y = height // block_size
    block_count = blocks_x * blocks_y

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # PPM P6 header:
    #   P6
    #   <width> <height>
    #   255
    header = f"P6\n{width} {height}\n255\n".encode("ascii")

    with output_path.open("wb") as output:
        output.write(header)

        for block_y in range(blocks_y):
            # Construct one pixel row for this row of blocks.
            row = bytearray()

            for block_x in range(blocks_x):
                block_index = block_y * blocks_x + block_x

                # Repeat from the beginning if there are more than
                # 65,536 blocks.
                rgb565 = block_index % RGB565_COLOR_COUNT
                red, green, blue = rgb565_to_rgb888(rgb565)

                # Repeat the color horizontally across the block.
                row.extend(bytes((red, green, blue)) * block_size)

            # Repeat the completed row vertically.
            for _ in range(block_size):
                output.write(row)

    unique_colors = min(block_count, RGB565_COLOR_COUNT)

    print(f"Wrote:            {output_path}")
    print(f"Image dimensions: {width}x{height}")
    print(f"Block dimensions: {block_size}x{block_size}")
    print(f"Number of blocks: {block_count:,}")
    print(f"Unique RGB565 colors used: {unique_colors:,}")

    if block_count > RGB565_COLOR_COUNT:
        repetitions = block_count / RGB565_COLOR_COUNT
        print(f"RGB565 color-set repetitions: {repetitions:g}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a binary PPM image containing aligned 4x4 blocks "
            "of RGB565-representable colors."
        )
    )

    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path("rgb565_blocks.ppm"),
        help="Output PPM path (default: rgb565_blocks.ppm)",
    )

    parser.add_argument(
        "--width",
        type=int,
        default=1024,
        help="Image width; must be a power of two (default: 1024)",
    )

    parser.add_argument(
        "--height",
        type=int,
        default=1024,
        help="Image height; must be a power of two (default: 1024)",
    )

    args = parser.parse_args()

    try:
        generate_ppm(
            output_path=args.output,
            width=args.width,
            height=args.height,
        )
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
