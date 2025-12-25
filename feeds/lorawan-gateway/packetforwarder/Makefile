#
# Copyright (C) 2022 TDT AG <development@tdt.de>
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
#
include $(TOPDIR)/rules.mk

PKG_NAME:=packetforwarder
PKG_VERSION:=2.1.0
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/Lora-net/sx1302_hal/tar.gz/V$(PKG_VERSION)?
PKG_HASH:=4b62aa6a83ad449c68fdd844fc35024586c9faabca3c5a90a2544735b380de5b
PKG_LICENSE_FILES:=LICENSE.TXT

include $(INCLUDE_DIR)/package.mk

define Package/packetforwarder/Default
  SECTION:=gateway
  CATEGORY:=Gateway
  TITLE:=SX1302/SX1303 HAL(add ubus message support)
endef

define Package/lora_pkt_fwd
  $(call Package/packetforwarder/Default)
  TITLE+=(Packet Forwarder)
  DEPENDS:=+kmod-usb-acm +kmod-spi-dev +librt +libpthread
endef

define Package/lora_pkt_fwd/description
  Packet Forwarders for SX1302/SX1303 Hardware Abstraction Layer
endef

define Package/lora_pkt_fwd/config
	select BUSYBOX_DEFAULT_USLEEP
endef

#TARGET_CFLAGS += $(FPIC) -O2 -Wall -Wextra -std=c99 -Iinc -I. -lm  -I../libtools/inc -DSPI_SPEED=$(CONFIG_SX1302_SPI_SPEED)
TARGET_CFLAGS = -O2 -Wall -Wextra -std=c99 -Iinc -I. -lm  -I../libtools/inc -DSPI_SPEED=$(CONFIG_SX1302_SPI_SPEED) -DI2C_DEVICE=\\\"$(CONFIG_SX1302_I2C_PATH)\\\" -DLED_NAME=\\\"$(CONFIG_SX1302_LED_NAME)\\\" -DLED_INTERVAL=\\\"$(CONFIG_SX1302_LED_INTERVAL)\\\"

define Package/lora_pkt_fwd/conffiles
/etc/config/packetforwarder
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(TAR) -C $(PKG_BUILD_DIR) --strip-components=1 -xf $(DL_DIR)/$(PKG_SOURCE)
	[ ! -d ./src/ ] || cp -fpR ./src/. $(PKG_BUILD_DIR)
	$(call Build/Patch/Default)
endef

define Package/lora_pkt_fwd/install
	$(INSTALL_DIR) $(1)/usr/bin/packetforwarder
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/packet_forwarder/lora_pkt_fwd $(1)/usr/bin/packetforwarder/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/packetforwarder $(1)/etc/config/packetforwarder

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/lora_pkt_fwd.init $(1)/etc/init.d/lora_pkt_fwd

	$(INSTALL_DIR) $(1)/etc/packetforwarder
	$(INSTALL_DATA) ./files/etc/packetforwarder/*.* $(1)/etc/packetforwarder/
endef

$(eval $(call BuildPackage,lora_pkt_fwd))
