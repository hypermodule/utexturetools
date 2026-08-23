cmake_minimum_required(VERSION 3.22)
project(bcencdec LANGUAGES CXX)

set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Build this target with emcmake so it uses Emscripten.")
endif()

add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/../vendor/bc7enc_rdo" bc7enc_rdo)

add_executable(bcencdec codec.cpp)
target_compile_features(bcencdec PRIVATE cxx_std_17)
target_compile_options(bcencdec PRIVATE -fno-exceptions -fno-rtti -msimd128)
target_link_libraries(bcencdec PRIVATE bc7enc_rdo)

set(BCENCDEC_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}" CACHE PATH
  "Directory for the generated bcencdec.wasm artifact")

set_target_properties(bcencdec PROPERTIES
  OUTPUT_NAME bcencdec
  SUFFIX ".wasm"
  RUNTIME_OUTPUT_DIRECTORY "${BCENCDEC_OUTPUT_DIRECTORY}"
)

target_link_options(bcencdec PRIVATE
  --no-entry
  -flto
  -msimd128
  -sSTANDALONE_WASM=1
  -sALLOW_MEMORY_GROWTH=1
  -sFILESYSTEM=0
  -sMALLOC=emmalloc
  -Wl,--allow-undefined
  -Wl,--export=codec_allocate
  -Wl,--export=codec_deallocate
  -Wl,--export=codec_initialize
  -Wl,--export=codec_decode
  -Wl,--export=codec_encode
)
