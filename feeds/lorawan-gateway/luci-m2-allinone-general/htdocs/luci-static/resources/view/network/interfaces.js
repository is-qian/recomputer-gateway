'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require firewall';
'require tools.widgets as widgets';
'require tools.network as nettools';

var isReadonlyView = !L.hasViewPermission() || null;

function count_changes(section_id) {
	var changes = ui.changes.changes, n = 0;

	if (!L.isObject(changes))
		return n;

	if (Array.isArray(changes.network))
		for (var i = 0; i < changes.network.length; i++)
			n += (changes.network[i][1] == section_id);

	if (Array.isArray(changes.dhcp))
		for (var i = 0; i < changes.dhcp.length; i++)
			n += (changes.dhcp[i][1] == section_id);

	return n;
}

function render_iface(dev, alias) {
	var type = dev ? dev.getType() : 'ethernet',
	    up   = dev ? dev.isUp() : false;

	return E('span', { class: 'cbi-tooltip-container' }, [
		E('img', { 'class' : 'middle', 'src': L.resource('icons/%s%s.png').format(
			alias ? 'alias' : type,
			up ? '' : '_disabled') }),
		E('span', { 'class': 'cbi-tooltip ifacebadge large' }, [
			E('img', { 'src': L.resource('icons/%s%s.png').format(
				type, up ? '' : '_disabled') }),
			L.itemlist(E('span', { 'class': 'left' }), [
				_('Type'),      dev ? dev.getTypeI18n() : null,
				_('Device'),    dev ? dev.getName() : _('Not present'),
				_('Connected'), up ? _('yes') : _('no'),
				_('MAC'),       dev ? dev.getMAC() : null,
				_('RX'),        dev ? '%.2mB (%d %s)'.format(dev.getRXBytes(), dev.getRXPackets(), _('Pkts.')) : null,
				_('TX'),        dev ? '%.2mB (%d %s)'.format(dev.getTXBytes(), dev.getTXPackets(), _('Pkts.')) : null
			])
		])
	]);
}

function render_status(node, ifc, with_device) {
	var desc = null, c = [];

	if (ifc.isDynamic())
		desc = _('Virtual dynamic interface');
	else if (ifc.isAlias())
		desc = _('Alias Interface');
	else if (!uci.get('network', ifc.getName()))
		return L.itemlist(node, [
			null, E('em', _('Interface is marked for deletion'))
		]);

	var i18n = ifc.getI18n();
	if (i18n)
		desc = desc ? '%s (%s)'.format(desc, i18n) : i18n;

	var changecount = with_device ? 0 : count_changes(ifc.getName()),
	    ipaddrs = changecount ? [] : ifc.getIPAddrs(),
	    ip6addrs = changecount ? [] : ifc.getIP6Addrs(),
	    errors = ifc.getErrors(),
	    maindev = ifc.getL3Device() || ifc.getDevice(),
	    macaddr = maindev ? maindev.getMAC() : null;

	return L.itemlist(node, [
		_('Protocol'), with_device ? null : (desc || '?'),
		_('Device'),   with_device ? (maindev ? maindev.getShortName() : E('em', _('Not present'))) : null,
		_('Uptime'),   (!changecount && ifc.isUp()) ? '%t'.format(ifc.getUptime()) : null,
		_('MAC'),      (!changecount && !ifc.isDynamic() && !ifc.isAlias() && macaddr) ? macaddr : null,
		_('RX'),       (!changecount && !ifc.isDynamic() && !ifc.isAlias() && maindev) ? '%.2mB (%d %s)'.format(maindev.getRXBytes(), maindev.getRXPackets(), _('Pkts.')) : null,
		_('TX'),       (!changecount && !ifc.isDynamic() && !ifc.isAlias() && maindev) ? '%.2mB (%d %s)'.format(maindev.getTXBytes(), maindev.getTXPackets(), _('Pkts.')) : null,
		_('IPv4'),     ipaddrs[0],
		_('IPv4'),     ipaddrs[1],
		_('IPv4'),     ipaddrs[2],
		_('IPv4'),     ipaddrs[3],
		_('IPv4'),     ipaddrs[4],
		_('IPv6'),     ip6addrs[0],
		_('IPv6'),     ip6addrs[1],
		_('IPv6'),     ip6addrs[2],
		_('IPv6'),     ip6addrs[3],
		_('IPv6'),     ip6addrs[4],
		_('IPv6'),     ip6addrs[5],
		_('IPv6'),     ip6addrs[6],
		_('IPv6'),     ip6addrs[7],
		_('IPv6'),     ip6addrs[8],
		_('IPv6'),     ip6addrs[9],
		_('IPv6-PD'),  changecount ? null : ifc.getIP6Prefix(),
		_('Information'), with_device ? null : (ifc.get('auto') != '0' ? null : _('Not started on boot')),
		_('Error'),    errors ? errors[0] : null,
		_('Error'),    errors ? errors[1] : null,
		_('Error'),    errors ? errors[2] : null,
		_('Error'),    errors ? errors[3] : null,
		_('Error'),    errors ? errors[4] : null,
		null, changecount ? E('a', {
			href: '#',
			click: L.bind(ui.changes.displayChanges, ui.changes)
		}, _('Interface has %d pending changes').format(changecount)) : null
	]);
}

function render_modal_status(node, ifc) {
	var dev = ifc ? (ifc.getDevice() || ifc.getL3Device() || ifc.getL3Device()) : null;

	dom.content(node, [
		E('img', {
			'src': L.resource('icons/%s%s.png').format(dev ? dev.getType() : 'ethernet', (dev && dev.isUp()) ? '' : '_disabled'),
			'title': dev ? dev.getTypeI18n() : _('Not present')
		}),
		ifc ? render_status(E('span'), ifc, true) : E('em', _('Interface not present or not connected yet.'))
	]);

	return node;
}

function render_ifacebox_status(node, ifc) {
	var dev = ifc.getL3Device() || ifc.getDevice(),
	    subdevs = dev ? dev.getPorts() : null,
	    c = [ render_iface(dev, ifc.isAlias()) ];

	if (subdevs && subdevs.length) {
		var sifs = [ ' (' ];

		for (var j = 0; j < subdevs.length; j++)
			sifs.push(render_iface(subdevs[j]));

		sifs.push(')');

		c.push(E('span', {}, sifs));
	}

	c.push(E('br'));
	c.push(E('small', {}, ifc.isAlias() ? _('Alias of "%s"').format(ifc.isAlias())
	                                    : (dev ? dev.getName() : E('em', _('Not present')))));

	dom.content(node, c);

	return firewall.getZoneByNetwork(ifc.getName()).then(L.bind(function(zone) {
		this.style.backgroundColor = zone ? zone.getColor() : '#EEEEEE';
		this.title = zone ? _('Part of zone %q').format(zone.getName()) : _('No zone assigned');
	}, node.previousElementSibling));
}

function iface_updown(up, id, ev, force) {
	var row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(id)),
	    dsc = row.querySelector('[data-name="_ifacestat"] > div'),
	    btns = row.querySelectorAll('.cbi-section-actions .reconnect, .cbi-section-actions .down');

	btns[+!up].blur();
	btns[+!up].classList.add('spinning');

	btns[0].disabled = true;

	if (!up) {
		L.resolveDefault(fs.exec_direct('/usr/libexec/luci-peeraddr')).then(function(res) {
			var info = null; try { info = JSON.parse(res); } catch(e) {}

			if (L.isObject(info) &&
			    Array.isArray(info.inbound_interfaces) &&
			    info.inbound_interfaces.filter(function(i) { return i == id })[0]) {

				ui.showModal(_('Confirm disconnect'), [
					E('p', _('You appear to be currently connected to the device via the "%h" interface. Do you really want to shut down the interface?').format(id)),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': function(ev) {
								btns[0].disabled = false;

								ui.hideModal();
							}
						}, _('Cancel')),
						' ',
						E('button', {
							'class': 'cbi-button cbi-button-negative important',
							'click': function(ev) {
								dsc.setAttribute('disconnect', '');
								dom.content(dsc, E('em', _('Interface is shutting down...')));

								ui.hideModal();
							}
						}, _('Disconnect'))
					])
				]);
			}
			else {
				dsc.setAttribute('disconnect', '');
				dom.content(dsc, E('em', _('Interface is shutting down...')));
			}
		});
	}
	else {
		dsc.setAttribute(up ? 'reconnect' : 'disconnect', force ? 'force' : '');
		dom.content(dsc, E('em', up ? _('Interface is reconnecting...') : _('Interface is shutting down...')));
	}
}

function get_netmask(s, use_cfgvalue) {
	var readfn = use_cfgvalue ? 'cfgvalue' : 'formvalue',
	    addrs = L.toArray(s[readfn](s.section, 'ipaddr')),
	    mask = s[readfn](s.section, 'netmask'),
	    firstsubnet = mask ? addrs[0] + '/' + mask : addrs.filter(function(a) { return a.indexOf('/') > 0 })[0];

	if (firstsubnet == null)
		return null;

	var subnetmask = firstsubnet.split('/')[1];

	if (!isNaN(subnetmask))
		subnetmask = network.prefixToMask(+subnetmask);

	return subnetmask;
}

var cbiRichListValue = form.ListValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Dropdown((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			optional: true,
			select_placeholder: this.select_placeholder || this.placeholder,
			custom_placeholder: this.custom_placeholder || this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},

	value: function(value, title, description) {
		if (description) {
			form.ListValue.prototype.value.call(this, value, E([], [
				E('span', { 'class': 'hide-open' }, [ title ]),
				E('div', { 'class': 'hide-close', 'style': 'min-width:25vw' }, [
					E('strong', [ title ]),
					E('br'),
					E('span', { 'style': 'white-space:normal' }, description)
				])
			]));
		}
		else {
			form.ListValue.prototype.value.call(this, value, title);
		}
	}
});

return view.extend({
	poll_status: function(map, networks) {
		var resolveZone = null;

		for (var i = 0; i < networks.length; i++) {
			var ifc = networks[i],
			    row = map.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(ifc.getName()));

			if (row == null)
				continue;

			var dsc = row.querySelector('[data-name="_ifacestat"] > div'),
			    box = row.querySelector('[data-name="_ifacebox"] .ifacebox-body'),
			    btn1 = row.querySelector('.cbi-section-actions .reconnect'),
			    stat = document.querySelector('[id="%s-ifc-status"]'.format(ifc.getName())),
			    resolveZone = render_ifacebox_status(box, ifc),
			    disabled = ifc ? !ifc.isUp() : true,
			    dynamic = ifc ? ifc.isDynamic() : false;

			if (dsc.hasAttribute('reconnect')) {
				dom.content(dsc, E('em', _('Interface is starting...')));
			}
			else if (dsc.hasAttribute('disconnect')) {
				dom.content(dsc, E('em', _('Interface is stopping...')));
			}
			else if (ifc.getProtocol() || uci.get('network', ifc.getName()) == null) {
				render_status(dsc, ifc, false);
			}
			else if (!ifc.getProtocol()) {
				var e = map.querySelector('[id="cbi-network-%s"] .cbi-button-edit'.format(ifc.getName()));
				if (e) e.disabled = true;

				var link = L.url('admin/system/opkg') + '?query=luci-proto';
				dom.content(dsc, [
					E('em', _('Unsupported protocol type.')), E('br'),
					E('a', { href: link }, _('Install protocol extensions...'))
				]);
			}
			else {
				dom.content(dsc, E('em', _('Interface not present or not connected yet.')));
			}

			if (stat) {
				var dev = ifc.getDevice();
				dom.content(stat, [
					E('img', {
						'src': L.resource('icons/%s%s.png').format(dev ? dev.getType() : 'ethernet', (dev && dev.isUp()) ? '' : '_disabled'),
						'title': dev ? dev.getTypeI18n() : _('Not present')
					}),
					render_status(E('span'), ifc, true)
				]);
			}

			btn1.disabled = isReadonlyView || btn1.classList.contains('spinning') || dynamic;
		}

		document.querySelectorAll('.port-status-device[data-device]').forEach(function(node) {
			nettools.updateDevBadge(node, network.instantiateDevice(node.getAttribute('data-device')));
		});

		document.querySelectorAll('.port-status-link[data-device]').forEach(function(node) {
			nettools.updatePortStatus(node, network.instantiateDevice(node.getAttribute('data-device')));
		});

		return Promise.all([ resolveZone, network.flushCache() ]);
	},

	load: function() {
		return Promise.all([
			network.getDSLModemType(),
			network.getDevices(),
			fs.lines('/etc/iproute2/rt_tables'),
			L.resolveDefault(fs.read('/usr/lib/opkg/info/netifd.control')),
			uci.changes()
		]);
	},

	interfaceBridgeWithIfnameSections: function() {
		return uci.sections('network', 'interface').filter(function(ns) {
			return ns.type == 'bridge' && !ns.ports && ns.ifname;
		});
	},

	deviceWithIfnameSections: function() {
		return uci.sections('network', 'device').filter(function(ns) {
			return ns.type == 'bridge' && !ns.ports && ns.ifname;
		});
	},

	interfaceWithIfnameSections: function() {
		return uci.sections('network', 'interface').filter(function(ns) {
			return !ns.device && ns.ifname;
		});
	},

	handleBridgeMigration: function(ev) {
		var tasks = [];

		this.interfaceBridgeWithIfnameSections().forEach(function(ns) {
			var device_name = 'br-' + ns['.name'];

			tasks.push(uci.callAdd('network', 'device', null, {
				'name': device_name,
				'type': 'bridge',
				'ports': L.toArray(ns.ifname),
				'mtu': ns.mtu,
				'macaddr': ns.macaddr,
				'igmp_snooping': ns.igmp_snooping
			}));

			tasks.push(uci.callSet('network', ns['.name'], {
				'type': '',
				'ifname': '',
				'mtu': '',
				'macaddr': '',
				'igmp_snooping': '',
				'device': device_name
			}));
		});

		return Promise.all(tasks)
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes));
	},

	renderBridgeMigration: function() {
		ui.showModal(_('Network bridge configuration migration'), [
			E('p', _('The existing network configuration needs to be changed for LuCI to function properly.')),
			E('p', _('Upon pressing "Continue", bridges configuration will be updated and the network will be restarted to apply the updated configuration.')),
			E('div', { 'class': 'right' },
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleBridgeMigration')
				}, _('Continue')))
		]);
	},

	handleIfnameMigration: function(ev) {
		var tasks = [];

		this.deviceWithIfnameSections().forEach(function(ds) {
			tasks.push(uci.callSet('network', ds['.name'], {
				'ifname': '',
				'ports': L.toArray(ds.ifname)
			}));
		});

		this.interfaceWithIfnameSections().forEach(function(ns) {
			tasks.push(uci.callSet('network', ns['.name'], {
				'ifname': '',
				'device': ns.ifname
			}));
		});

		return Promise.all(tasks)
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes));
	},

	renderIfnameMigration: function() {
		ui.showModal(_('Network ifname configuration migration'), [
			E('p', _('The existing network configuration needs to be changed for LuCI to function properly.')),
			E('p', _('Upon pressing "Continue", ifname options will get renamed and the network will be restarted to apply the updated configuration.')),
			E('div', { 'class': 'right' },
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleIfnameMigration')
				}, _('Continue')))
		]);
	},

	render: function(data) {
		var netifdVersion = (data[3] || '').match(/Version: ([^\n]+)/);

		if (netifdVersion && netifdVersion[1] >= "2021-05-26") {
			if (this.interfaceBridgeWithIfnameSections().length)
				return this.renderBridgeMigration();
			else if (this.deviceWithIfnameSections().length || this.interfaceWithIfnameSections().length)
				return this.renderIfnameMigration();
		}

		var dslModemType = data[0],
		    netDevs = data[1],
		    m, s, o;

		var rtTables = data[2].map(function(l) {
			var m = l.trim().match(/^(\d+)\s+(\S+)$/);
			return m ? [ +m[1], m[2] ] : null;
		}).filter(function(e) {
			return e && e[0] > 0;
		});

		m = new form.Map('network');
		m.tabbed = false;
		m.chain('dhcp');

		s = m.section(form.GridSection, 'interface', _('Interfaces'));
		s.anonymous = true;
		s.addremove = false;

		s.load = function() {
			return Promise.all([
				network.getNetworks(),
				firewall.getZones()
			]).then(L.bind(function(data) {
				this.networks = data[0];
				this.zones = data[1];
			}, this));
		};

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		
		s.cfgsections = function() {
			return this.networks.map(function(n) { return n.getName() })
				.filter(function(n) { return n != 'loopback' });
		};

		s.modaltitle = function(section_id) {
			return _('Interfaces') + ' » ' + section_id.toUpperCase();
		};

		s.renderRowActions = function(section_id) {
			var tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]),
			    net = this.networks.filter(function(n) { return n.getName() == section_id })[0],
			    disabled = net ? !net.isUp() : true,
			    dynamic = net ? net.isDynamic() : false;

			dom.content(tdEl.lastChild, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral reconnect',
					'click': iface_updown.bind(this, true, section_id),
					'title': _('Reconnect this interface'),
					'disabled': dynamic ? 'disabled' : null
				}, _('Restart')),
				tdEl.lastChild.firstChild,
				tdEl.lastChild.lastChild
			]);

			if (!dynamic && net && !uci.get('network', net.getName())) {
				tdEl.lastChild.childNodes[0].disabled = true;
				tdEl.lastChild.childNodes[2].disabled = true;
				tdEl.lastChild.childNodes[3].disabled = true;
			}

			return tdEl;
		};

		s.addModalOptions = function(s) {
			var protoval = uci.get('network', s.section, 'proto'),
			    protoclass = protoval ? network.getProtocol(protoval) : null,
			    o, proto_select, proto_switch, type, stp, igmp, ss, so;

			if (!protoval)
				return;

			return network.getNetwork(s.section).then(L.bind(function(ifc) {
				var protocols = network.getProtocols();

				protocols.sort(function(a, b) {
					return a.getProtocol() > b.getProtocol();
				});

				o = s.taboption('general', form.DummyValue, '_ifacestat_modal', _('Status'));
				o.modalonly = true;
				o.cfgvalue = L.bind(function(section_id) {
					var net = this.networks.filter(function(n) { return n.getName() == section_id })[0];

					return render_modal_status(E('div', {
						'id': '%s-ifc-status'.format(section_id),
						'class': 'ifacebadge large'
					}), net);
				}, this);
				o.write = function() {};

				ifc.renderFormOptions(s);

				if (protoval != 'static') {
					o = nettools.replaceOption(s, 'advanced', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'), _('If unchecked, the advertised DNS server addresses are ignored'));
					o.default = o.enabled;
				}
				o = nettools.replaceOption(s, 'advanced', form.DynamicList, 'dns', _('Use custom DNS servers'));
				if (protoval != 'static')
					o.depends('peerdns', '0');
				o.datatype = 'ipaddr';

				o = nettools.replaceOption(s, 'advanced', form.DynamicList, 'dns_search', _('DNS search domains'));
				if (protoval != 'static')
					o.depends('peerdns', '0');
				o.datatype = 'hostname';
				
				this.activeSection = s.section;
			}, this));
		};

		s.handleModalCancel = function(/* ... */) {
			var type = uci.get('network', this.activeSection || this.addedSection, 'type'),
			    device = (type == 'bridge') ? 'br-%s'.format(this.activeSection || this.addedSection) : null;

			uci.sections('network', 'bridge-vlan', function(bvs) {
				if (device != null && bvs.device == device)
					uci.remove('network', bvs['.name']);
			});

			return form.GridSection.prototype.handleModalCancel.apply(this, arguments);
		};

		o = s.option(form.DummyValue, '_ifacebox');
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var net = this.section.networks.filter(function(n) { return n.getName() == section_id })[0],
			    zone = net ? this.section.zones.filter(function(z) { return !!z.getNetworks().filter(function(n) { return n == section_id })[0] })[0] : null;

			if (!net)
				return;

			var node = E('div', { 'class': 'ifacebox' }, [
				E('div', {
					'class': 'ifacebox-head',
					'style': 'background-color:%s'.format(zone ? zone.getColor() : '#EEEEEE'),
					'title': zone ? _('Part of zone %q').format(zone.getName()) : _('No zone assigned')
				}, E('strong', net.getName().toUpperCase())),
				E('div', {
					'class': 'ifacebox-body',
					'id': '%s-ifc-devices'.format(section_id),
					'data-network': section_id
				}, [
					E('img', {
						'src': L.resource('icons/ethernet_disabled.png'),
						'style': 'width:16px; height:16px'
					}),
					E('br'), E('small', '?')
				])
			]);

			render_ifacebox_status(node.childNodes[1], net);

			return node;
		};

		o = s.option(form.DummyValue, '_ifacestat');
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var net = this.section.networks.filter(function(n) { return n.getName() == section_id })[0];

			if (!net)
				return;

			var node = E('div', { 'id': '%s-ifc-description'.format(section_id) });

			render_status(node, net, false);

			return node;
		};

		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				var section_ids = m.children[0].cfgsections(),
				    tasks = [];

				for (var i = 0; i < section_ids.length; i++) {
					var row = nodes.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(section_ids[i])),
					    dsc = row.querySelector('[data-name="_ifacestat"] > div'),
					    btn1 = row.querySelector('.cbi-section-actions .reconnect');

					if (dsc.getAttribute('reconnect') == '') {
						dsc.setAttribute('reconnect', '1');
						tasks.push(fs.exec('/sbin/ifup', [section_ids[i]]).catch(function(e) {
							ui.addNotification(null, E('p', e.message));
						}));
					}
					else if (dsc.getAttribute('disconnect') == '') {
						dsc.setAttribute('disconnect', '1');
						tasks.push(fs.exec('/sbin/ifdown', [section_ids[i]]).catch(function(e) {
							ui.addNotification(null, E('p', e.message));
						}));
					}
					else if (dsc.getAttribute('reconnect') == '1') {
						dsc.removeAttribute('reconnect');
						btn1.classList.remove('spinning');
						btn1.disabled = false;
					}
					else if (dsc.getAttribute('disconnect') == '1') {
						dsc.removeAttribute('disconnect');
					}
				}
				
				return Promise.all(tasks)
					.then(L.bind(network.getNetworks, network))
					.then(L.bind(this.poll_status, this, nodes));
			}, this), 5);

			return nodes;
		}, this, m));
	}
});
