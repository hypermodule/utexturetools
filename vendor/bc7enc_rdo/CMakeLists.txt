cmake_minimum_required(VERSION 3.22)
project(bc7enc_rdo LANGUAGES CXX)

add_library(bc7enc_rdo STATIC
  bc7enc.cpp
  bc7decomp.cpp
  rgbcx.cpp
)

target_include_directories(bc7enc_rdo PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_features(bc7enc_rdo PUBLIC cxx_std_11)
target_compile_definitions(bc7enc_rdo PUBLIC RGBCX_USE_SMALLER_TABLES=1)

if(EMSCRIPTEN)
  target_compile_options(bc7enc_rdo PRIVATE -fno-exceptions -fno-rtti -msimd128)
endif()
