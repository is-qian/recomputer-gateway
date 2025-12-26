#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-m2-allinone-general
PKG_VERSION:=1.4.4
PKG_RELEASE:=1

LUCI_TYPE:=col
LUCI_BASENAME:=m2-allinone

LUCI_TITLE:=LuCI interface with Uhttpd (SenseCAP M2 AllinOne)
LUCI_DESCRIPTION:=Standard OpenWrt set including full admin with ppp support and the default Bootstrap theme
LUCI_DEPENDS:= \
	+uhttpd +uhttpd-mod-ubus \
	+luci-proto-ppp +libiwinfo-lua +IPV6:luci-proto-ipv6 \
	+rpcd-mod-rrdns \
	+lua +luci-lib-nixio +luci-lib-ip +rpcd +libubus-lua +luci-lib-jsonc +liblucihttp-lua +luci-lib-base \
	+rpcd-mod-file +rpcd-mod-luci +cgi-io

PKG_LICENSE:=Apache-2.0

# include $(TOPDIR)/feeds/luci/luci.mk

## from base

HOST_BUILD_DIR:=$(BUILD_DIR_HOST)/$(PKG_NAME)

include $(INCLUDE_DIR)/host-build.mk

define Package/luci-m2-allinone-general/conffiles
/etc/luci-uploads
/etc/config/luci
/etc/config/ucitrack
/etc/config/reboot_config
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Host/Configure
endef

define Host/Compile
	$(MAKE) -C src/ clean po2lmo jsmin
endef

define Host/Install
	$(INSTALL_DIR) $(1)/bin
	$(INSTALL_BIN) src/po2lmo $(1)/bin/po2lmo
	$(INSTALL_BIN) src/jsmin $(1)/bin/jsmin
endef

$(eval $(call HostBuild))


# call BuildPackage - OpenWrt buildroot signature
