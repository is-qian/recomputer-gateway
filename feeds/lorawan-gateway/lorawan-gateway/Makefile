include $(TOPDIR)/rules.mk

PKG_NAME:=lorawan-gateway
PKG_VERSION:=1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=ruiqian tang <ruiqian.tang@seeed.cc>
PKG_LICENSE:=Apache-2.0

include $(INCLUDE_DIR)/package.mk

define Package/lorawan-gateway
	SECTION:=lorawan gateway
	CATEGORY:=LoRaWAN Gateway
	TITLE:=LoRaWAN Gateway Configuration
	DEPENDS:=
endef

define Package/lorawan-gateway/description
	Provides configuration files for LoRaWAN Gateway.
endef

define Package/lorawan-gateway/conffiles
	/etc/config/lorawan-gateway
endef

define Package/lorawan-gateway/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/lorawan-gateway.config $(1)/etc/config/lorawan-gateway
endef

define Build/Compile
	# Nothing to do
endef

$(eval $(call BuildPackage,lorawan-gateway))