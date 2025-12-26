'use strict';
'require rpc';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require poll';
'require view.network.gauge as gauge';

document.querySelector('head').appendChild(E('link', {
    'rel': 'stylesheet',
    'type': 'text/css',
    'href': L.resource('view/network/speedtest.css')
}));

var callSpeedtest = rpc.declare({
    object: 'sensecap',
    method: 'speed_test',
    params: ['state']
});
var callSpeedinfo = rpc.declare({
    object: 'sensecap',
    method: 'speed_info',
});

var speed_test_started = 0;
var download_target = null;
var upload_target = null;
var download_speed = null;
var upload_speed = null;

var opts = {
    angle: -0.25,
    lineWidth: 0.2,
    radiusScale: 0.8,
    colorStop: "#79F1A4",
    percentColors: [
        [0.0, "#E0E0E0"],
        [0.10, "#73FFF2"],
        [0.20, "#6EE6F0"],
        [0.30, "#69CDEE"],
        [0.40, "#64B4EC"],
        [0.50, "#5F9BEA"],
        [0.60, "#5A82E8"],
        [0.70, "#5569E6"],
        [0.80, "#5550E6"],
        [0.90, "#5037E4"],
        [1.00, "#4630E0"]
    ],
    pointer: {
        length: 0.6,
        strokeWidth: 0.05,
        color: '#28C76F'
    },
    staticLabels: {
        font: "13px sans-serif",
        labels: [0, 10, 50, 100, 150, 200, 300],
        fractionDigits: 0
    },
    limitMax: true,
    limitMin: true,
    highDpiSupport: true
};


return view.extend({
    handleCommand: function(exec, args) {
        var buttons = document.querySelectorAll('.diag-action > .cbi-button');

        for (var i = 0; i < buttons.length; i++)
            buttons[i].setAttribute('disabled', 'true');

        return fs.exec(exec, args).then(function(res) {
            var out = document.querySelector('.command-output');
            out.style.display = '';

            dom.content(out, [res.stdout || '', res.stderr || '']);
        }).catch(function(err) {
            ui.addNotification(null, E('p', [err]))
        }).finally(function() {
            for (var i = 0; i < buttons.length; i++)
                buttons[i].removeAttribute('disabled');
        });
    },

    handlePing: function(ev, cmd) {
        var exec = cmd || 'ping',
            addr = ev.currentTarget.parentNode.previousSibling.value,
            args = (exec == 'ping') ? ['-4', '-c', '5', '-W', '1', addr] : ['-6', '-c', '5', addr];

        return this.handleCommand(exec, args);
    },

    handleTraceroute: function(ev, cmd) {
        var exec = cmd || 'traceroute',
            addr = ev.currentTarget.parentNode.previousSibling.value,
            args = (exec == 'traceroute') ? ['-4', '-q', '1', '-w', '1', '-n', addr] : ['-q', '1', '-w', '2', '-n', addr];

        return this.handleCommand(exec, args);
    },

    handleNslookup: function(ev, cmd) {
        var addr = ev.currentTarget.parentNode.previousSibling.value;

        return this.handleCommand('nslookup', [addr]);
    },


    load: function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/bin/ping6'), {}),
            L.resolveDefault(fs.stat('/usr/bin/ping6'), {}),
            L.resolveDefault(fs.stat('/bin/traceroute6'), {}),
            L.resolveDefault(fs.stat('/usr/bin/traceroute6'), {}),
            uci.load('luci'),
            callSpeedtest(0),
            L.Poll.add(function() {

                if (download_target == null) {
                    download_target = document.getElementById('download');
                    if (download_target == null)
                        return;
                    download_speed = new gauge.Gauge(download_target).setOptions(opts);
                    download_speed.setTextField(document.getElementById("download-textfield"), 2);
                    download_speed.maxValue = 300;
                    download_speed.setMinValue(0);
                    download_speed.set(0);
                    document.getElementById('download-labelfield').innerHTML = _("Download (Mbps)");
                }
                if (upload_target == null) {
                    upload_target = document.getElementById('upload');
                    if (upload_target == null)
                        return;
                    upload_speed = new gauge.Gauge(upload_target).setOptions(opts);
                    upload_speed.setTextField(document.getElementById("upload-textfield"), 2);
                    upload_speed.maxValue = 300;
                    upload_speed.setMinValue(0);
                    upload_speed.set(0);
                    document.getElementById('upload-labelfield').innerHTML = _("Upload (Mbps)");
                }
                if (speed_test_started == 1) {
                    callSpeedinfo().then(L.bind(function(data) {
                        if (data['state'] != '0') {
                            document.getElementById('apn').innerHTML = data['apn'];
                            document.getElementById('server').innerHTML = data['server'];
                            document.getElementById('latency').innerHTML = data['latency'];
                        }
                        if (data['state'] == '2') {
                            download_speed.set(data['recv']);
                        }
                        if (data['state'] == '3') {
                            upload_speed.set(data['send']);
                        }
                        if (data['state'] == '0') {
                            var btn = document.getElementById('btnSpeed');
                            btn.innerHTML = _("Go");
                            speed_test_started = 0;
                        }
                        if (data['state'] == '4') {
                            var btn = document.getElementById('btnSpeed');
                            btn.innerHTML = _("Failed");
                            speed_test_started = 0;
                        }
                    }));
                }
            }, 1)
        ]);
    },

    render: function(res) {
        var has_ping6 = res[0].path || res[1].path,
            has_traceroute6 = res[2].path || res[3].path,
            dns_host = uci.get('luci', 'diag', 'dns') || 'openwrt.org',
            ping_host = uci.get('luci', 'diag', 'ping') || 'openwrt.org',
            route_host = uci.get('luci', 'diag', 'route') || 'openwrt.org';


        return E([], [
            E('h2', {}, [_('Network Utilities')]),
            E('table', { 'class': 'table' }, [
                E('tr', { 'class': 'tr' }, [
                    E('td', { 'class': 'td left' }, [
                        E('input', {
                            'style': 'margin:5px 0',
                            'type': 'text',
                            'value': ping_host
                        }),
                        E('span', { 'class': 'diag-action' }, [
                            has_ping6 ? new ui.ComboButton('ping', {
                                'ping': '%s %s'.format(_('IPv4'), _('Ping')),
                                'ping6': '%s %s'.format(_('IPv6'), _('Ping')),
                            }, {
                                'click': ui.createHandlerFn(this, 'handlePing'),
                                'classes': {
                                    'ping': 'btn cbi-button cbi-button-action',
                                    'ping6': 'btn cbi-button cbi-button-action'
                                }
                            }).render() : E('button', {
                                'class': 'cbi-button cbi-button-action',
                                'click': ui.createHandlerFn(this, 'handlePing')
                            }, [_('Ping')])
                        ])
                    ]),

                    E('td', { 'class': 'td left' }, [
                        E('input', {
                            'style': 'margin:5px 0',
                            'type': 'text',
                            'value': route_host
                        }),
                        E('span', { 'class': 'diag-action' }, [
                            has_traceroute6 ? new ui.ComboButton('traceroute', {
                                'traceroute': '%s %s'.format(_('IPv4'), _('Traceroute')),
                                'traceroute6': '%s %s'.format(_('IPv6'), _('Traceroute')),
                            }, {
                                'click': ui.createHandlerFn(this, 'handleTraceroute'),
                                'classes': {
                                    'traceroute': 'btn cbi-button cbi-button-action',
                                    'traceroute6': 'btn cbi-button cbi-button-action'
                                }
                            }).render() : E('button', {
                                'class': 'cbi-button cbi-button-action',
                                'click': ui.createHandlerFn(this, 'handleTraceroute')
                            }, [_('Traceroute')])
                        ])
                    ]),

                    E('td', { 'class': 'td left' }, [
                        E('input', {
                            'style': 'margin:5px 0',
                            'type': 'text',
                            'value': dns_host
                        }),
                        E('span', { 'class': 'diag-action' }, [
                            E('button', {
                                'class': 'cbi-button cbi-button-action',
                                'click': ui.createHandlerFn(this, 'handleNslookup')
                            }, [_('Nslookup')])
                        ])
                    ])
                ]),
            ]),
            E('tr', { 'class': 'tr speed_container' }, [
                E('td', { 'class': 'td center' }, [
                    E('div', { 'id': 'download-textfield', 'class': 'preview_textfield' }),
                    E('canvas', { 'id': 'download' }),
                    E('div', { 'id': 'download-labelfield', 'class': 'label_textfield' })
                ]),
                E('td', { 'class': 'td center' }, [
                    E('button', {
                        'id': 'btnSpeed',
                        'class': 'cbi-button speed_btn',
                        'click': function() {
                            if (speed_test_started == 0) {
                                document.getElementById('apn').innerHTML = '';
                                document.getElementById('server').innerHTML = '';
                                document.getElementById('latency').innerHTML = '';
                                download_speed.set(0);
                                upload_speed.set(0);
                                callSpeedtest(1).then(function(data) {
                                    if (data['state'] == '1') {
                                        speed_test_started = 1;
                                        document.getElementById('btnSpeed').innerHTML = _("Testing...");
                                    }
                                });
                            }
                        },
                    }, _('GO')),
                    E('div', { 'id': 'apn', 'class': 'info_textfield' }),
                    E('div', { 'id': 'server', 'class': 'info_textfield' }),
                    E('div', { 'id': 'latency', 'class': 'info_textfield' })
                ]),
                E('td', { 'class': 'td center' }, [
                    E('div', { 'id': 'upload-textfield', 'class': 'preview_textfield' }),
                    E('canvas', { 'id': 'upload' }),
                    E('div', { 'id': 'upload-labelfield', 'class': 'label_textfield' })
                ])
            ]),
            E('pre', { 'class': 'command-output', 'style': 'display:none' })
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});