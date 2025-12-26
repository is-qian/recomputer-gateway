'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require rpc';
'require form';
'require poll';
'require request';
'require network';


var eui;

var packet_forwarder = {
  view: function (m) {

    //Packet Forwarder
    var gateway_conf_s = m.section(form.TypedSection, 'gateway_conf', _('Packet Forwarder Settings'));
    gateway_conf_s.anonymous = true;

    gateway_conf_s.tab('general', _('General Settings'));
    gateway_conf_s.tab('interval', _('Intervals Settings'));
    gateway_conf_s.tab('beacon', _('Beacon Settings'));
    gateway_conf_s.tab('gps', _('GPS Information'));
    gateway_conf_s.tab('forward', _('Forward Rules'));
    gateway_conf_s.tab('packet_filter', _('Packet Filter'));

    // general tab
    var gweui= gateway_conf_s.taboption("general", form.Value, "gateway_ID", _("Gateway EUI"))
    gweui.datatype = 'length(16)';
    gweui.default= eui;
    gweui.rmempty= false;

    var ttn_addr = gateway_conf_s.taboption("general", form.Value, "server_address", _("Server Address"));
    
    ttn_addr.value("eu1.cloud.thethings.network", "eu1.cloud.thethings.network");
    ttn_addr.value("nam1.cloud.thethings.network", "nam1.cloud.thethings.network");
    ttn_addr.default="eu1.cloud.thethings.network";
    ttn_addr.rmempty= false;
    ttn_addr.datatype='or(ipaddr,hostname)';

    var serv_port_up = gateway_conf_s.taboption("general", form.Value, "serv_port_up", _("Server Port (Up)"));
    serv_port_up.default="1700";
    serv_port_up.rmempty= false;
    serv_port_up.datatype = "port";

    var serv_port_down = gateway_conf_s.taboption("general", form.Value, "serv_port_down", _("Server Port (Down)"));
    serv_port_down.default="1700";
    serv_port_down.rmempty= false;
    serv_port_down.datatype = "port";

    // interval tab
    var keepalive_interval = gateway_conf_s.taboption("interval", form.Value, "keepalive_interval", _("Keep Alive Interval (s)"))
    keepalive_interval.default = "5"
    keepalive_interval.rmempty= false;
    keepalive_interval.datatype = "uinteger"

    var push_timeout_ms = gateway_conf_s.taboption("interval", form.Value, "push_timeout_ms", _("Push Timeout (ms)"))
    push_timeout_ms.default = "950"    
    push_timeout_ms.datatype = "uinteger"


    var stat_interval = gateway_conf_s.taboption("interval", form.Value, "stat_interval", _("Statistic Interval (s)"))
    stat_interval.default = "30";
    stat_interval.datatype = "uinteger";

    var stat_interval = gateway_conf_s.taboption("interval", form.Value, "stat_report_interval_multiple", _("Statistic Report Interval"), _("Statistic package reporting interval multiple configuration. Report Interval =  Multiple * Statistic Interval"))
    stat_interval.default = "1";
    stat_interval.datatype = "uinteger";

    // beacon tab
    var beacon_period_validate = function(section_id, value) {
      if (value > 0  &&  value < 6) {
        return "Invalid value for Beacon period, must be >= 6 seconds.";
      } else {
        return true
      }
    }

    var beacon_period = gateway_conf_s.taboption("beacon", form.Value, "beacon_period", _("Beacon Period"), _("Setting this value to 0 disables class B beacon."))
    beacon_period.default = "0";  /* disable class B beacon */
    beacon_period.datatype = "uinteger"
    beacon_period.validate=beacon_period_validate

    var beacon_freq_hz = gateway_conf_s.taboption("beacon", form.Value, "beacon_freq_hz", _("Beacon Frequency (Hz)"))
    beacon_freq_hz.datatype = "uinteger"

    var beacon_freq_nb = gateway_conf_s.taboption("beacon", form.Value, "beacon_freq_nb", _("Beacon Channel Number"))
    beacon_freq_nb.datatype = "uinteger"

    var beacon_freq_step = gateway_conf_s.taboption("beacon", form.Value, "beacon_freq_step", _("Beacon Frequency Step"))
    beacon_freq_step.datatype = "uinteger"

    var beacon_datarate = gateway_conf_s.taboption("beacon", form.ListValue, "beacon_datarate", _("Beacon Datarate"))
    beacon_datarate.value(8, "SF8")
    beacon_datarate.value(9, "SF9")
    beacon_datarate.value(10, "SF10")
    beacon_datarate.value(12, "SF12")
    beacon_datarate.default ="9"

    var beacon_bw_hz = gateway_conf_s.taboption("beacon", form.Value, "beacon_bw_hz", _("Beacon Bandwidth"))
    beacon_bw_hz.default = "125000";
    beacon_bw_hz.datatype = "uinteger"

    var beacon_power = gateway_conf_s.taboption("beacon", form.Value, "beacon_power", _("Beacon Tx Power"))
    beacon_power.default = "14"
    beacon_power.datatype = "float"

    var beacon_infodesc = gateway_conf_s.taboption("beacon", form.Value, "beacon_infodesc", _("Beaconing information descriptor"))
    beacon_infodesc.default = "0"

    // gps tab
    var fake_gps = gateway_conf_s.taboption("gps", form.Flag, "fake_gps", _("Fake GPS"))

    var latitude = gateway_conf_s.taboption("gps", form.Value, "latitude", _("Latitude"))
    latitude.datatype = "float"

    var longitude = gateway_conf_s.taboption("gps", form.Value, "longitude", _("Longitude"))
    longitude.datatype = "float"

    var altitude = gateway_conf_s.taboption("gps", form.Value, "altitude", _("Altitude"))
    altitude.datatype = "float"

    // forward tab
    var forward_crc_valid = gateway_conf_s.taboption("forward", form.ListValue, "forward_crc_valid", _("Forward When CRC Valid"))
    forward_crc_valid.value("true", "True")
    forward_crc_valid.value("false", "False")
    forward_crc_valid.default = "true"

    var forward_crc_error = gateway_conf_s.taboption("forward", form.ListValue, "forward_crc_error", _("Forward When CRC Error"))
    forward_crc_error.value("true", "True")
    forward_crc_error.value("false", "False")
    forward_crc_error.default = "false"

    var forward_crc_disabled = gateway_conf_s.taboption("forward", form.ListValue, "forward_crc_disabled", _("Forward When CRC Disabled"))
    forward_crc_disabled.value("true", "True")
    forward_crc_disabled.value("false", "False")
    forward_crc_disabled.default = "false"

    // packet_filter tab
    var whitelist_enable = gateway_conf_s.taboption("packet_filter", form.Flag, "whitelist_enable", _("Enable White List Mode"),_("OUI filters Join packets; NetID and DevAddr filter uplink packets, they are \"OR\" filters"))
    whitelist_enable.default = 0

    var whitelist_ouis = gateway_conf_s.taboption("packet_filter", form.DynamicList, "whitelist_ouis", _("OUI List"), _("Please enter three-byte hexadecimal, eg: SenseCAP Node OUI is '2CF7F1'.Note: Maximum 16 items"))
    whitelist_ouis.datatype = "hexstring"
  
    var whitelist_netids = gateway_conf_s.taboption("packet_filter", form.DynamicList, "whitelist_netids", _("Network ID List"), _("Please enter three-byte hexadecimal, eg: SenseCAP TTN NetID is '000013'. Note: Maximum 16 items"))
    whitelist_netids.datatype = "hexstring"

    var whitelist_devaddr_min = gateway_conf_s.taboption("packet_filter", form.Value, "whitelist_devaddr_min", _("Devaddr Min"), _("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '27000000'"))
    whitelist_devaddr_min.default = "00000000"
    whitelist_devaddr_min.datatype = "hexstring"

    var whitelist_devaddr_max = gateway_conf_s.taboption("packet_filter", form.Value, "whitelist_devaddr_max", _("Devaddr Max"),_("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '2701FFFF'"))
    whitelist_devaddr_max.default = "00000000"
    whitelist_devaddr_max.datatype = "hexstring"

    return gateway_conf_s;
  }
}


//station config
var station = {
  view: function (m) {

    var station_s = m.section(form.TypedSection, 'station', _('Basic Station Settings'));
    station_s.anonymous = true;

    station_s.tab('general', _('General Settings'));
    station_s.tab('packet_filter', _('Packet Filter'));
    
    // general tab
    var gweui = station_s.taboption("general",form.Value, "gateway_ID", _("Gateway EUI"))
    gweui.datatype = 'length(16)';
    gweui.default= eui;
    gweui.rmempty= false;

    var stype = station_s.taboption("general",form.ListValue, "server", _("Server"))
    stype.value("cups_boot", "CUPS Boot Server")
    stype.value("cups", "CUPS Server")
    stype.value("lns", "LNS Server")
    stype.default="lns";
    stype.rmempty= false;
    
    var uri = station_s.taboption("general",form.Value, "uri", _("URI"),_("For example CUPS https://server-address:443, LNS wss://server-address:8887"))
    uri.rmempty= false;

    var auth_mode = station_s.taboption("general",form.ListValue, "auth_mode", _("Authentication Mode"))
    auth_mode.value("none", "No Authentication")
    auth_mode.value("tls-server", "TLS Server Authentication")
    auth_mode.value("tls-server-client", "TLS Server and Client Authentication")
    auth_mode.value("tls-server-token", "TLS Server Authentication and Client Token")

    var trust = station_s.taboption("general",form.TextValue, "_trust", _("trust"))
    trust.rmempty= false;
    trust.wrap = "off"
    trust.rows = 6
    trust.depends("auth_mode", "tls-server")
    trust.depends("auth_mode", "tls-server-client")
    trust.depends("auth_mode", "tls-server-token")
    trust.load = function () {
      return fs.trimmed('/etc/station/server.trust') || ""
    }
    trust.write = function (section_id, formvalue) {
      if (formvalue) {
        return fs.write('/etc/station/server.trust', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
      }
    };

    var crt = station_s.taboption("general",form.TextValue, "_crt", _("certificate"))
    crt.rmempty= false;
    crt.wrap = "off"
    crt.rows = 6
    crt.depends("auth_mode", "tls-server-client")
    crt.load = function () {
      return fs.trimmed('/etc/station/client.crt') || ""
    }
    crt.write = function (section_id, formvalue) {
      if (formvalue) {
        return fs.write('/etc/station/client.crt', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
      }
    };

    var key = station_s.taboption("general",form.TextValue, "_key", _("key"))
    key.rmempty= false;
    key.depends("auth_mode", "tls-server-client")
    key.wrap = "off"
    key.rows = 6
    key.load = function () {
      return fs.trimmed('/etc/station/client.key') || ""
    }
    key.write = function (section_id, formvalue) {
      if (formvalue) {
        return fs.write('/etc/station/client.key', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
      }
    };

    var token = station_s.taboption("general",form.Value, "token", _("token"))
    token.depends("auth_mode", "tls-server-token")
    token.rmempty= false;

    // packet_filter tab
    var whitelist_enable = station_s.taboption("packet_filter", form.Flag, "whitelist_enable", _("Enable White List Mode"),_("OUI filters Join packets; NetID and DevAddr filter uplink packets, they are \"OR\" filters"))
    whitelist_enable.default = 0

    var whitelist_ouis = station_s.taboption("packet_filter", form.DynamicList, "whitelist_ouis", _("OUI List"), _("Please enter three-byte hexadecimal, eg: SenseCAP Node OUI is '2CF7F1'.Note: Maximum 16 items"))
    whitelist_ouis.datatype = "hexstring"
  
    var whitelist_netids = station_s.taboption("packet_filter", form.DynamicList, "whitelist_netids", _("Network ID List"), _("Please enter three-byte hexadecimal, eg: SenseCAP TTN NetID is '000013'. Note: Maximum 16 items"))
    whitelist_netids.datatype = "hexstring"

    var whitelist_devaddr_min = station_s.taboption("packet_filter", form.Value, "whitelist_devaddr_min", _("Devaddr Min"), _("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '27000000'"))
    whitelist_devaddr_min.default = "00000000"
    whitelist_devaddr_min.datatype = "hexstring"

    var whitelist_devaddr_max = station_s.taboption("packet_filter", form.Value, "whitelist_devaddr_max", _("Devaddr Max"),_("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '2701FFFF'"))
    whitelist_devaddr_max.default = "00000000"
    whitelist_devaddr_max.datatype = "hexstring"
    
    return station_s
  }
}

var network_server = {
  view: function (m) {
    var ns = m.section(form.TypedSection, 'network_server', _('Network Server Settings'), _('This mode implicitly starts packet forwarder with well-tuned parameters except the Beacon parameters.'));
    ns.anonymous = true;

    ns.tab('chirpstack', _('ChirpStack'));
    ns.tab('beacon', _('Packet Forwarder Beacon'));

    // chirpstack tab
    // mqtt
    var mqttHost = ns.taboption("chirpstack", form.Value, "mqtt_host", _("MQTT Broker Host"), _("Leaving this empty diables the MQTT integration. Currently only unencrypted MQTT is supported."));
    mqttHost.default = "";
    mqttHost.placeholder = "IP address or host domain";
    mqttHost.rmempty = false;
    mqttHost.datatype = "or(ipaddr,hostname)";
    mqttHost.optional = true;

    var mqttPort = ns.taboption("chirpstack", form.Value, "mqtt_port", _("MQTT Broker Port"));
    mqttPort.default = 1883;
    mqttPort.rmempty = false;
    mqttPort.datatype = "port";

    var mqttUser = ns.taboption("chirpstack", form.Value, "mqtt_user", _("MQTT User"));
    mqttUser.rmempty = false;
    mqttUser.optional = true;

    var mqttPassword = ns.taboption("chirpstack", form.Value, "mqtt_password", _("MQTT Password"));
    mqttPassword.rmempty = false;
    mqttPassword.optional = true;
    mqttPassword.password = true;

    var mqttQos = ns.taboption("chirpstack", form.Value, "mqtt_qos", _("MQTT QoS"));
    mqttQos.datatype = 'range(0,2)';
    mqttQos.default = 0;
    mqttQos.rmempty = false;

    var mqttClientId = ns.taboption("chirpstack", form.Value, "mqtt_client_id", _("MQTT Client ID"));
    mqttClientId.datatype = 'maxlength(23)';
    mqttClientId.rmempty = false;
    mqttClientId.optional = true;

    var mqttKeepAlive = ns.taboption("chirpstack", form.Value, "mqtt_keep_alive", _("MQTT Keep Alive Time"), _("60 (seconds) is a commonly used default value for most brokers to cooperate with."));
    mqttKeepAlive.default = 60;
    mqttKeepAlive.rmempty = false;
    mqttKeepAlive.datatype = 'range(1,86400)';

    //rx1
    var rx1Delay = ns.taboption("chirpstack", form.Value, "rx1_delay", _("RX1 Delay"));
    rx1Delay.datatype = 'range(1,15)';
    rx1Delay.default = 3;
    rx1Delay.rmempty = false;

    //event cache
    var cacheMaxCnt = ns.taboption("chirpstack", form.Value, "cache_max_cnt", _("Max. Integration Event Cache"), _("The max number of integration events that will be cached for network outage."));
    cacheMaxCnt.default = 1000;
    cacheMaxCnt.rmempty = false;
    cacheMaxCnt.datatype = 'range(1,5000)';

    // scheduler
    var enableSchedulerClassBc = ns.taboption("chirpstack", form.Flag, "enable_sch_classbc", _("Class B/C Downlink Scheduler"), _("If no Class B/C devices in the application, keeping this disabled will save resource usage, so that network performance will be enhanced."));
    enableSchedulerClassBc.default = 0;

    var enableSchedulerMulticast = ns.taboption("chirpstack", form.Flag, "enable_sch_multicast", _("Multicast Downlink Scheduler"), _("If no multicast groups created in the application, keeping this disabled will save resource usage, so that network performance will be enhanced."));
    enableSchedulerMulticast.default = 0;

    var chirpstackLink = ns.taboption("chirpstack", form.DummyValue, "whatever", _(""));
    chirpstackLink.cfgvalue = function (section_id) {
      return "More configurations can be done via ChirpStack GUI, http://" + window.location.hostname + ":8080";
    }


    //beacon tab
    var beacon_period_validate = function(section_id, value) {
      if (value > 0  &&  value < 6) {
        return "Invalid value for Beacon period, must be >= 6 seconds.";
      } else {
        return true
      }
    }

    var beacon_period = ns.taboption("beacon", form.Value, "beacon_period", _("Beacon Period"), _("Setting this value to 0 disables class B beacon."))
    beacon_period.default = "0";  /* disable class B beacon */
    beacon_period.datatype = "uinteger"
    beacon_period.validate=beacon_period_validate

    var beacon_freq_hz = ns.taboption("beacon", form.Value, "beacon_freq_hz", _("Beacon Frequency (Hz)"))
    beacon_freq_hz.datatype = "uinteger"

    var beacon_freq_nb = ns.taboption("beacon", form.Value, "beacon_freq_nb", _("Beacon Channel Number"))
    beacon_freq_nb.datatype = "uinteger"

    var beacon_freq_step = ns.taboption("beacon", form.Value, "beacon_freq_step", _("Beacon Frequency Step"))
    beacon_freq_step.datatype = "uinteger"

    var beacon_datarate = ns.taboption("beacon", form.ListValue, "beacon_datarate", _("Beacon Datarate"))
    beacon_datarate.value(8, "SF8")
    beacon_datarate.value(9, "SF9")
    beacon_datarate.value(10, "SF10")
    beacon_datarate.value(12, "SF12")
    beacon_datarate.default ="9"

    var beacon_bw_hz = ns.taboption("beacon", form.Value, "beacon_bw_hz", _("Beacon Bandwidth"))
    beacon_bw_hz.default = "125000";
    beacon_bw_hz.datatype = "uinteger"

    var beacon_power = ns.taboption("beacon", form.Value, "beacon_power", _("Beacon Tx Power"))
    beacon_power.default = "14"
    beacon_power.datatype = "float"

    var beacon_infodesc = ns.taboption("beacon", form.Value, "beacon_infodesc", _("Beaconing information descriptor"))
    beacon_infodesc.default = "0"

    return ns;
  }
}

var sensecap_ttn = {
  view: function (m) {
    return true;  
  }
}


var section = {
  sensecap_ttn: sensecap_ttn,
  packet_forwarder: packet_forwarder,
  basic_station: station,
  network_server: network_server,
}

function handleSwitchMode (mode) {
  console.log("Switch to " + mode);
	var m = lora_network_render(mode)
	return m.render().then(LuCI.prototype.bind(node => {
		var vp = document.getElementById('cbi-lora_network');
		DOM.content(vp, node);
	}, this))
}

function lora_network_render(mode_cur) {
  var m, s;

  m = new form.Map('lora_network', 'LoRaWAN Network Settings');

  s = m.section(form.TypedSection, 'network');
  s.anonymous = true;
  s.addremove = false;

  var gweui = s.option(form.DummyValue, "gateway_ID", _("Gateway EUI"))
  gweui.cfgvalue = function () {
    return eui;
  }

  var mode = s.option(form.ListValue, "mode", _("Mode"))
  mode.value("sensecap_ttn", "SenseCAP")
  mode.value("packet_forwarder", "Packet Forwarder")
  mode.value("basic_station", "Basics Station")
  mode.value("network_server", "Local Network Server")
  mode.default = "sensecap_ttn"
  mode.cfgvalue = function() {
    return mode_cur
  }
  mode.onchange = function(ev, section_id, values) {
		handleSwitchMode(values)
	};

  switch (mode_cur)
  {
    case "sensecap_ttn" :{
      section["sensecap_ttn"].view(m)
      break;
    }
    case "packet_forwarder" :{
      section["packet_forwarder"].view(m)
      break;
    }
    case "basic_station" :{
      section["basic_station"].view(m)
      break;
    }
    case "network_server" :{
      section["network_server"].view(m)
      break;
    }
    default: {
      section["sensecap_ttn"].view(m)
    }
  }
  return m;
}

return view.extend({

  load: function () {
    return Promise.all([
      uci.load('lora_network'),
      fs.lines('/etc/deviceinfo/eui'),
    ]);
  },

  render: function (results) {
    eui = results[1];
    var mode = uci.get('lora_network', 'network', 'mode');
    var m = lora_network_render(mode);
    return m.render();
  },

  handleSaveApply: function (ev) {
    console.log("handleSaveApply")

    var tasks = [];
    document.getElementById('maincontent')
      .querySelectorAll('.cbi-map').forEach(function (map) {
        tasks.push(DOM.callClassMethod(map, 'save'));
      });
    Promise.all(tasks);
    ui.changes.apply(true);

    setTimeout(function () {
      fs.exec('/etc/init.d/lora_pkt_fwd', ['restart']);
    }, 3000);
    setTimeout(function () {
      fs.exec('/etc/init.d/station', ['restart']);
    }, 3100);
    setTimeout(function () {
      fs.exec('/etc/init.d/redis', ['restart']);
    }, 3200);
    setTimeout(function () {
      console.log("will restart chirpstack...");
      fs.exec('/etc/init.d/chirpstack', ['restart']);
    }, 4000);
  },
  handleSave: null,
  handleReset: null
});