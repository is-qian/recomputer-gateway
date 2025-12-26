
# 安装LXC和桥接网络
sudo apt update
sudo apt install lxc lxc-templates
sudo reboot

# bridge network
sudo apt update
sudo apt install bridge-utils
sudo nano /etc/dhcpcd.conf
'''
# Bridge setup for dynamic IP
denyinterfaces eth0
interface br0
bridge_interfaces eth0
bridge_stp off
bridge_fd 0
'''
sudo brctl addbr br0
sudo brctl addif br0 eth0
sudo ip link set br0 up

# 配置LXC容器
sudo lxc-create -n openwrt -t download -- -d openwrt -r 24.10 -a arm64
sudo nano /var/lib/lxc/openwrt/config
'''
# Distribution configuration
lxc.include = /usr/share/lxc/config/common.conf
lxc.arch = aarch64

# Container specific configuration
lxc.apparmor.profile = unconfined
lxc.apparmor.allow_nesting = 1
lxc.rootfs.path = dir:/var/lib/lxc/openwrt/rootfs
lxc.uts.name = openwrt

# Network configuration
lxc.net.0.type = phys
lxc.net.0.link = eth0
lxc.net.0.flags = up
lxc.net.0.name = eth0

lxc.cgroup2.devices.allow = c 89:* rwm
lxc.cgroup2.devices.allow = c 254:* rwm
lxc.cgroup2.devices.allow = c 153:* rwm
lxc.mount.entry = /dev/i2c-6 dev/i2c-1 none bind,optional,create=file
lxc.mount.entry = /dev/spidev1.1 dev/spidev0.1 none bind,optional,create=file
lxc.mount.entry = /dev/gpiochip2 dev/gpiochip2 none bind,optional,create=file

lxc.mount.entry = /sys/class/gpio sys/class/gpio none rbind,create=dir 0 0
lxc.mount.entry = /sys/class/gpio sys/class/gpio none remount,rw,bind 0 0
'''

sudo lxc-start -n openwrt
sudo lxc-ls -f
sudo lxc-attach -n openwrt

# 配置防火墙,打开wan口的web和ssh访问
vi /etc/config/firewall
'''
config rule
    option name 'Allow-WAN-HTTP'
    option src 'wan'
    option proto 'tcp'
    option dest_port '80'
    option target 'ACCEPT'  
    option family 'ipv4'

config rule
    option name 'Allow-ssh-WAN'
    option src 'wan'
    option proto 'tcp'
    option dest_port '22'
    option target 'ACCEPT'  
    option family 'ipv4'
'''
/etc/init.d/firewall restart

vi /etc/config/network
'''
config interface 'loopback'
        option device 'lo'
        option proto 'static'
        option ipaddr '127.0.0.1'
        option netmask '255.0.0.0'

config globals 'globals'
        option ula_prefix 'fdf4:628a:1dc9::/48'

config interface 'wan'
        option device 'eth0'
        option proto 'dhcp'
'''
/etc/init.d/network restart

# 安装必要的软件包
opkg update
opkg install openssh-sftp-server mosquitto redis-server redis-cli i2c-tools gpio-tools spi-tools bash coreutils-sleep


# 编译ChirpStack LoRa Gateway Bridge IPK包
cp feeds.conf.default openwrt/feeds.conf.default

cd openwrt
make distclean
./scripts/feeds update -a
./scripts/feeds install -a

make menuconfig (select Target Syste -> Broadcom BCM27xx and Subtarget -> Broadcom BCM2711 and Target Profile -> Raspberry Pi 4 and Build the Openwrt SDK)

make toolchain/install -j16
make package/chirpstack/compile -j16
scp ./*.ipk root@192.168.130.102:/tmp/tmp
ssh root@192.168.130.102

opkg update
opkg install /tmp/tmp/*.ipk
nano /etc/config/chirpstack-concentratord
'''
config sx1302
        option model 'seeed_wm1302'
        option antenna_gain '0'
        option sx1302_reset_pin '2'
        option sx1302_reset_chip '/dev/gpiochip2'
        option sx1302_power_en_pin '0'
        option sx1302_power_en_chip '/dev/gpiochip2'
        option sx1261_reset_pin '1'
        option sx1261_reset_chip '/dev/gpiochip2'
        option com_dev_path '/dev/spidev1.1'
        option i2c_dev_path '/dev/i2c-1'
        option channel_plan ''
        option region ''
        option antenna_gain     '2'
'''


uci show basicstation
uci set basicstation.station.radioInit='/usr/bin/wm1302-reset.sh'
uci commit basicstation
/etc/init.d/basicstation restart


# 编译OpenWrt固件步骤参考README.md
cp .config openwrt/.config
cp feeds.conf.default openwrt/feeds.conf.default
cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a
make -j$(nproc) V=s

opkg update
opkg install openssh-sftp-server
scp bin/targets/armsr/armv8/openwrt-armsr-armv8-generic-rootfs.tar.gz seeed@192.168.130.104:/home/seeed


# 在树莓派中使用lxc运行OpenWrtT
sudo lxc-stop -n openwrt
sudo rm -rf /var/lib/lxc/openwrt/rootfs/*
sudo mkdir -p /var/lib/lxc/openwrt/rootfs
sudo tar -xzf /home/seeed/openwrt-armsr-armv8-generic-rootfs.tar.gz -C /var/lib/lxc/openwrt/rootfs
sudo lxc-start -n openwrt
sudo lxc-attach -n openwrt


git format-patch HEAD^