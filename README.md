# reComputer Gateway OpenWrt Firmware

This project provides the build environment and configuration for the reComputer Gateway OpenWrt firmware. It is based on OpenWrt 24.10 and integrates ChirpStack components for LoRaWAN gateway functionality.

## Features

- **Base System**: OpenWrt 24.10
- **LoRaWAN**: Integrated ChirpStack Gateway Bridge / Concentratord
- **Hardware Support**: Pre-configured for reComputer Gateway
- **Custom Feeds**: Includes custom feeds for LoRaWAN support

## Directory Structure

- `feeds/`: Contains custom feeds for ChirpStack and LoRaWAN gateway packages.
- `openwrt/`: The OpenWrt source code (submodule).
- `.config`: Default OpenWrt build configuration.
- `feeds.conf.default`: Custom feeds configuration.

## Build Instructions

### Prerequisites

Ensure you have a Linux environment with the necessary build tools installed. You can refer to the [OpenWrt Build System Setup](https://openwrt.org/docs/guide-developer/build-system/install-buildsystem) guide.

Common dependencies (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install build-essential clang flex bison g++ gawk gcc-multilib g++-multilib \
gettext git libncurses5-dev libssl-dev python3-distutils rsync unzip zlib1g-dev \
file wget
```

### Quick Start

1.  **Clone this repository:**

    ```bash
    git clone <repository_url>
    cd recomputer-gateway
    ```

2.  **Initialize Submodules:**

    Download the OpenWrt source code and other submodules.

    ```bash
    git submodule update --init --recursive
    ```

    *Note: If you prefer to manually clone OpenWrt or if the submodule update fails, you can clone it directly:*
    ```bash
    # Only if submodule update fails
    git clone -b openwrt-24.10 https://github.com/openwrt/openwrt.git
    ```

3.  **Setup Configuration and Feeds:**

    Copy the configuration files to the OpenWrt directory.

    ```bash
    cp .config openwrt/.config
    cp feeds.conf.default openwrt/feeds.conf.default
    ```

4.  **Update and Install Feeds:**

    Navigate to the OpenWrt directory and install the feeds.

    ```bash
    cd openwrt
    ./scripts/feeds update -a
    ./scripts/feeds install -a
    ```

5.  **Build Firmware:**

    Start the build process. The `-j` option specifies the number of parallel jobs (adjust based on your CPU cores). `V=s` enables verbose output to see compilation details and errors.

    ```bash
    make -j$(nproc) V=s
    ```

    The built firmware images will be located in `openwrt/bin/targets/armsr/armv8`.

## Customization

To customize the firmware (e.g., add packages, change kernel settings), run `menuconfig` inside the `openwrt` directory:

```bash
cd openwrt
make menuconfig
```
