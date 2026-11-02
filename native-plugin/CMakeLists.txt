cmake_minimum_required(VERSION 3.28)
project(lltv_placar_obs VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(libobs REQUIRED)
find_package(obs-frontend-api REQUIRED)
find_package(Qt6 REQUIRED COMPONENTS Core Widgets)

add_library(lltv-placar MODULE src/plugin.cpp)
target_link_libraries(lltv-placar PRIVATE
    OBS::libobs
    OBS::obs-frontend-api
    Qt6::Core
    Qt6::Widgets
)

set_target_properties(lltv-placar PROPERTIES
    PREFIX ""
    OUTPUT_NAME "lltv-placar"
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN YES
)

if(WIN32)
    set_target_properties(lltv-placar PROPERTIES SUFFIX ".dll")
endif()

install(TARGETS lltv-placar
    LIBRARY DESTINATION obs-plugins/64bit
    RUNTIME DESTINATION obs-plugins/64bit
)
