'use strict';
'require view';
'require poll';
'require ui';
'require uci';
'require rpc';
'require form';

var callInitList, callInitAction, callTimezone,
    callGetLocaltime, callSetLocaltime, CBILocalTime;

callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	params: [ 'name' ],
	expect: { '': {} },
	filter: function(res) {
		for (var k in res)
			return +res[k].enabled;
		return null;
	}
});

callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

callGetLocaltime = rpc.declare({
	object: 'luci',
	method: 'getLocaltime',
	expect: { result: 0 }
});

callSetLocaltime = rpc.declare({
	object: 'luci',
	method: 'setLocaltime',
	params: [ 'localtime' ],
	expect: { result: 0 }
});

callTimezone = rpc.declare({
	object: 'luci',
	method: 'getTimezones',
	expect: { '': {} }
});

CBILocalTime = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		return E([], [
			E('input', {
				'id': 'localtime',
				'type': 'text',
				'readonly': true,
				'value': new Date(cfgvalue * 1000).toLocaleString()
			}),
			E('br'),
			E('span', { 'class': 'control-group' }, [
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return callSetLocaltime(Math.floor(Date.now() / 1000));
					}),
					'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
				}, _('Sync with browser')),
				' ',
				this.ntpd_support ? E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return callInitAction('sysntpd', 'restart');
					}),
					'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
				}, _('Sync with NTP-Server')) : ''
			])
		]);
	},
});

return view.extend({
	load: function() {
		return Promise.all([
			callInitList('sysntpd'),
			callTimezone(),
			callGetLocaltime(),
			uci.load('luci'),
			uci.load('system')
		]);
	},

	render: function(rpc_replies) {
		var ntpd_enabled = rpc_replies[0],
		    timezones = rpc_replies[1],
		    localtime = rpc_replies[2],
		    m, s, o;

		m = new form.Map('system',
			_('System'),
			_('Here you can configure the basic aspects of your device like its hostname or the timezone.'));

		m.chain('luci');

		s = m.section(form.TypedSection, 'system', _('System Properties'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('timesync', _('Time Synchronization'));

		/*
		 * System Properties
		 */

		o = s.taboption('general', CBILocalTime, '_systime', _('Local Time'));
		o.cfgvalue = function() { return localtime };
		o.ntpd_support = ntpd_enabled;
	
		o = s.taboption('general', form.Value, 'hostname', _('Hostname'));
		o.datatype = 'hostname';

		/* could be used also as a default for LLDP, SNMP "system description" in the future */
		o = s.taboption('general', form.Value, 'description', _('Description'), _('An optional, short description for this device'));
		o.optional = true;

		o = s.taboption('general', form.TextValue, 'notes', _('Notes'), _('Optional, free-form notes about this device'));
		o.optional = true;

		o = s.taboption('general', form.ListValue, 'zonename', _('Timezone'));
		o.value('UTC');

		var zones = Object.keys(timezones || {}).sort();
		for (var i = 0; i < zones.length; i++)
			o.value(zones[i]);

		o.write = function(section_id, formvalue) {
			var tz = timezones[formvalue] ? timezones[formvalue].tzstring : null;
			uci.set('system', section_id, 'zonename', formvalue);
			uci.set('system', section_id, 'timezone', tz);
		};

		o = s.taboption('general', form.Flag, 'enable_low_data', _('Enable low data cosumption mode.'), _('Note: After the change,restart the gateway to take effect'));
		o.default = 0
		o = s.taboption('general', form.Value, 'sensecap_keepalive', _('SenseCAP Keep alive time'), _('In low data cosumption mode, the keepalive time for connecting to the platform, unit:s'));
		o.default = 86400
		o.datatype = "uinteger"

		/*
		 * NTP
		 */

		if (L.hasSystemFeature('sysntpd')) {
			var default_servers = [
				'0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org',
				'2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'
			];

			o = s.taboption('timesync', form.Flag, 'enabled', _('Enable NTP client'));
			o.rmempty = false;
			o.ucisection = 'ntp';
			o.default = o.disabled;
			o.write = function(section_id, value) {
				ntpd_enabled = +value;

				if (ntpd_enabled && !uci.get('system', 'ntp')) {
					uci.add('system', 'timeserver', 'ntp');
					uci.set('system', 'ntp', 'server', default_servers);
				}

				if (!ntpd_enabled)
					uci.set('system', 'ntp', 'enabled', 0);
				else
					uci.unset('system', 'ntp', 'enabled');

				return callInitAction('sysntpd', 'enable');
			};
			o.load = function(section_id) {
				return (ntpd_enabled == 1 &&
				        uci.get('system', 'ntp') != null &&
				        uci.get('system', 'ntp', 'enabled') != 0) ? '1' : '0';
			};

			o = s.taboption('timesync', form.Flag, 'enable_server', _('Provide NTP server'));
			o.ucisection = 'ntp';
			o.depends('enabled', '1');

			o = s.taboption('timesync', form.Flag, 'use_dhcp', _('Use DHCP advertised servers'));
			o.ucisection = 'ntp';
			o.default = o.enabled;
			o.depends('enabled', '1');

			o = s.taboption('timesync', form.DynamicList, 'server', _('NTP server candidates'));
			o.datatype = 'host(0)';
			o.ucisection = 'ntp';
			o.depends('enabled', '1');
			o.load = function(section_id) {
				return uci.get('system', 'ntp', 'server');
			};
		}

		return m.render().then(function(mapEl) {
			poll.add(function() {
				return callGetLocaltime().then(function(t) {
					mapEl.querySelector('#localtime').value = new Date(t * 1000).toLocaleString();
				});
			});

			return mapEl;
		});
	}
});
