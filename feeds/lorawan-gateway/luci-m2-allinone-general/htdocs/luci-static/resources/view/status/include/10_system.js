'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

var callSupervisorServiceVer = rpc.declare({
	object: 'supervisor',
	method: 'service_ver',
	params: ['service'],
	reject: true
});


var callGps = rpc.declare({
	object: 'sensecap',
	method: 'gps',
	reject: true
});

var callUciSystemTz = rpc.declare({
	object: 'uci',
	method: 'get',
	params: ['config','section','option'],
	reject: true
});

var callLteInfo = rpc.declare({
	object: 'sensecap',
	method: 'lte_info',
	reject: true
});

return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			fs.lines('/usr/lib/lua/luci/version.lua'),
			fs.lines('/etc/deviceinfo/model'),
			fs.lines('/etc/os_version'),
			fs.lines('/usr/lib/opkg/version'),
			L.resolveDefault(callGps(), {}),
			fs.lines('/etc/deviceinfo/K3SN'),
			L.resolveDefault(callUciSystemTz('system', '@system[0]', 'zonename'), {}),
			uci.load('lora_radio'),
			fs.lines('/etc/deviceinfo/eui'),
			L.resolveDefault(callLteInfo(), {}),
		]);
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    luciversion = data[2],
			deviceType  = data[3],
			osVersion   = data[4],
			fwVersion   = data[5],
			gpsInfo     = data[6],
			k3sn        = data[7],
			tzInfo		= data[8],
			loraRegion  = uci.get('lora_radio', 'freq_plan', 'region'),
			eui		    = data[10],
			lteInfo		= data[11]; 

		console.log(gpsInfo);
		console.log(tzInfo);

		luciversion = luciversion.filter(function(l) {
			return l.match(/^\s*(luciname|luciversion)\s*=/);
		}).map(function(l) {
			return l.replace(/^\s*\w+\s*=\s*['"]([^'"]+)['"].*$/, '$1');
		}).join(' ');

		deviceType = deviceType.join('').trim();
		k3sn = k3sn.join('').trim();
		var buildVerion = L.isObject(boardinfo.release) ? boardinfo.release.description.toLowerCase().split(' ')[2].trim() : "--";
		osVersion = osVersion.join('').trim();
		fwVersion = fwVersion.join('').trim();
		eui = eui.join('').trim();

		var lorawanRegion = "--";
		if (loraRegion) {
			lorawanRegion = loraRegion;
		}
		var gpsStr = "--";
		if (L.isObject(gpsInfo) && 'state' in gpsInfo) {
			const { state, longitude, latitude } = gpsInfo;
			if (state == 1) {
				gpsStr = `${latitude},${longitude} (lat,lon)`;
			}
		}

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);

			if (L.isObject(tzInfo) && 'value' in tzInfo) datestr += ` (${tzInfo.value})`;
		}

		var imei_s = "--";
		var iccid_s = "--";
		var rssi_s = "--";
		if (L.isObject(lteInfo) && 'state' in lteInfo) {
			const { state, iccid, imei, rssi } = lteInfo;
			if (state == 1) {
				imei_s = imei;
				iccid_s = iccid;
				rssi_s = rssi;
			}
		}

		var fields = [
			_('Hostname'),         boardinfo.hostname,
			_('Model'),            deviceType ? deviceType : "--",
			_('SN'),               k3sn ? k3sn : "--",
			_('EUI'),              eui ? eui : "--",
			_('Build Version'),    buildVerion,
			_('OS Version'),       osVersion ? osVersion : "--",
			_('Firmware Version'), fwVersion ? fwVersion : "--",
			_('LoRaWAN Region'),   lorawanRegion,
			_('GPS'),              gpsStr,
			_('IMEI'),             imei_s,
			_('ICCID'),            iccid_s,
			_('LTE RSSI'),         rssi_s,
			_('Local Time'),       datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			_('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
				systeminfo.load[0] / 65535.0,
				systeminfo.load[1] / 65535.0,
				systeminfo.load[2] / 65535.0
			) : null
		];

		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [ (fields[i + 1] != null) ? fields[i + 1] : '?' ])
			]));
		}

		return table;
	}
});
