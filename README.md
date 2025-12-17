# Seeed gateway packages for OpenWrt

This project provides the build environment and default configuration for the reComputer Gateway firmware based on OpenWrt. It integrates LoRa gateway support across **ChirpStack**, **Semtech packet_forwarder**, and **Basic Station**, and also includes cellular (4G/LTE) dial-up networking plus MQTT and serial (UART/RS485) related utilities.

## Features

- **Base System**: OpenWrt 
- **LoRaWAN**: Supports multiple LoRa gateway stacks/platforms: **ChirpStack**, **Semtech packet_forwarder**, and **Basic Station**
- **Cellular (4G/LTE)**: Supports 4G dial-up networking for Internet access
- **Services**: MQTT and serial (UART/RS485) related utilities

## Directory Structure

- `feeds/`: Contains custom feeds for ChirpStack and LoRaWAN gateway packages.
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
    git clone https://github.com/openwrt/openwrt.git
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
