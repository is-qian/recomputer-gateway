'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require rpc';
'require uci';
'require form';
'require network';
'require firewall';
'require tools.widgets as widgets';

var isReadonlyView = !L.hasViewPermission();

var isConnecting = true; 

var callWifiState = rpc.declare({
    object: 'sensecap',
    method: 'wifi_state',
    params: ['state']
});

function count_changes(section_id) {
    var changes = ui.changes.changes,
        n = 0;

    if (!L.isObject(changes))
        return n;

    if (Array.isArray(changes.wireless))
        for (var i = 0; i < changes.wireless.length; i++)
            n += (changes.wireless[i][1] == section_id);

    return n;
}

function render_radio_badge(radioDev) {
    return E('span', { 'class': 'ifacebadge' }, [
        E('img', { 'src': L.resource('icons/wifi%s.png').format(radioDev.isUp() ? '' : '_disabled') }),
        ' ',
        radioDev.getName()
    ]);
}

function render_signal_badge(signalPercent, signalValue, noiseValue, wrap, mode) {
    var icon, title, value;

    if (signalPercent < 0)
        icon = L.resource('icons/signal-none.png');
    else if (signalPercent == 0)
        icon = L.resource('icons/signal-0.png');
    else if (signalPercent < 25)
        icon = L.resource('icons/signal-0-25.png');
    else if (signalPercent < 50)
        icon = L.resource('icons/signal-25-50.png');
    else if (signalPercent < 75)
        icon = L.resource('icons/signal-50-75.png');
    else
        icon = L.resource('icons/signal-75-100.png');

    if (signalValue != null && signalValue != 0) {
        if (noiseValue != null && noiseValue != 0) {
            value = '%d/%d\xa0%s'.format(signalValue, noiseValue, _('dBm'));
            title = '%s: %d %s / %s: %d %s / %s %d'.format(
                _('Signal'), signalValue, _('dBm'),
                _('Noise'), noiseValue, _('dBm'),
                _('SNR'), signalValue - noiseValue);
        } else {
            value = '%d\xa0%s'.format(signalValue, _('dBm'));
            title = '%s: %d %s'.format(_('Signal'), signalValue, _('dBm'));
        }
    } else if (signalPercent > -1) {
        switch (mode) {
            case 'ap':
                title = _('No client associated');
                break;

            case 'sta':
            case 'adhoc':
            case 'mesh':
                title = _('Not associated');
                break;

            default:
                title = _('No RX signal');
        }

        if (noiseValue != null && noiseValue != 0) {
            value = '---/%d\x0a%s'.format(noiseValue, _('dBm'));
            title = '%s / %s: %d %s'.format(title, _('Noise'), noiseValue, _('dBm'));
        } else {
            value = '---\xa0%s'.format(_('dBm'));
        }
    } else {
        value = E('em', {}, E('small', {}, [_('disabled')]));
        title = _('Interface is disabled');
    }

    return E('div', {
        'class': wrap ? 'center' : 'ifacebadge',
        'title': title,
        'data-signal': signalValue,
        'data-noise': noiseValue
    }, [
        E('img', { 'src': icon }),
        E('span', {}, [
            wrap ? E('br') : ' ',
            value
        ])
    ]);
}

function render_network_badge(radioNet) {
    return render_signal_badge(
        radioNet.isUp() ? radioNet.getSignalPercent() : -1,
        radioNet.getSignal(), radioNet.getNoise(), false, radioNet.getMode());
}

function render_radio_status(radioDev, wifiNets) {
    var name = radioDev.getI18n().replace(/ Wireless Controller .+$/, ''),
        node = E('div', [E('big', {}, E('strong', {}, name)), E('div')]),
        channel, frequency, bitrate;

    for (var i = 0; i < wifiNets.length; i++) {
        channel = channel || wifiNets[i].getChannel();
        frequency = frequency || wifiNets[i].getFrequency();
        bitrate = bitrate || wifiNets[i].getBitRate();
    }

    if (radioDev.isUp())
        L.itemlist(node.lastElementChild, [
            _('Channel'), '%s (%s %s)'.format(channel || '?', frequency || '?', _('GHz')),
            _('Bitrate'), '%s %s'.format(bitrate || '?', _('Mbit/s'))
        ], ' | ');
    else
        node.lastElementChild.appendChild(E('em', _('Device is not active')));

    return node;
}

function render_network_status(radioNet) {
    var mode = radioNet.getActiveMode(),
        bssid = radioNet.getActiveBSSID(),
        channel = radioNet.getChannel(),
        disabled = (radioNet.get('disabled') == '1' || uci.get('wireless', radioNet.getWifiDeviceName(), 'disabled') == '1'),
        is_assoc = (bssid && bssid != '00:00:00:00:00:00' && channel && mode != 'Unknown' && !disabled),
        is_mesh = (radioNet.getMode() == 'mesh'),
        changecount = count_changes(radioNet.getName()),
        status_text = null;

    if (changecount)
        status_text = E('a', {
            href: '#',
            click: L.bind(ui.changes.displayChanges, ui.changes)
        }, _('Interface has %d pending changes').format(changecount));
    else if (!is_assoc)
        status_text = E('em', disabled ? _('Wireless is disabled') : _('Wireless is not associated'));

    return L.itemlist(E('div'), [
        is_mesh ? _('Mesh ID') : _('SSID'), (is_mesh ? radioNet.getMeshID() : radioNet.getSSID()) || '?',
        _('Mode'), mode,
        _('BSSID'), (!changecount && is_assoc) ? bssid : null,
        _('Encryption'), (!changecount && is_assoc) ? radioNet.getActiveEncryption() || _('None') : null,
        null, status_text
    ], [' | ', E('br')]);
}

function render_modal_status(node, radioNet) {
    var mode = radioNet.getActiveMode(),
        noise = radioNet.getNoise(),
        bssid = radioNet.getActiveBSSID(),
        channel = radioNet.getChannel(),
        disabled = (radioNet.get('disabled') == '1'),
        is_assoc = (bssid && bssid != '00:00:00:00:00:00' && channel && mode != 'Unknown' && !disabled);

    if (node == null)
        node = E('span', { 'class': 'ifacebadge large', 'data-network': radioNet.getName() }, [E('small'), E('span')]);

    dom.content(node.firstElementChild, render_signal_badge(
        disabled ? -1 : radioNet.getSignalPercent(),
        radioNet.getSignal(), noise, true, radioNet.getMode()));

    L.itemlist(node.lastElementChild, [
        _('Mode'), mode,
        _('SSID'), radioNet.getSSID() || '?',
        _('BSSID'), is_assoc ? bssid : null,
        _('Encryption'), is_assoc ? radioNet.getActiveEncryption() || _('None') : null,
        _('Channel'), is_assoc ? '%d (%.3f %s)'.format(radioNet.getChannel(), radioNet.getFrequency() || 0, _('GHz')) : null,
        _('Tx-Power'), is_assoc ? '%d %s'.format(radioNet.getTXPower(), _('dBm')) : null,
        _('Signal'), is_assoc ? '%d %s'.format(radioNet.getSignal(), _('dBm')) : null,
        _('Noise'), (is_assoc && noise != null) ? '%d %s'.format(noise, _('dBm')) : null,
        _('Bitrate'), is_assoc ? '%.1f %s'.format(radioNet.getBitRate() || 0, _('Mbit/s')) : null,
        _('Country'), is_assoc ? radioNet.getCountryCode() : null
    ], [' | ', E('br'), E('br'), E('br'), E('br'), E('br'), ' | ', E('br'), ' | ']);

    if (!is_assoc)
        dom.append(node.lastElementChild, E('em', disabled ? _('Wireless is disabled') : _('Wireless is not associated')));

    return node;
}

function format_wifirate(rate) {
    var s = '%.1f\xa0%s, %d\xa0%s'.format(rate.rate / 1000, _('Mbit/s'), rate.mhz, _('MHz')),
        ht = rate.ht,
        vht = rate.vht,
        mhz = rate.mhz,
        nss = rate.nss,
        mcs = rate.mcs,
        sgi = rate.short_gi,
        he = rate.he,
        he_gi = rate.he_gi,
        he_dcm = rate.he_dcm;

    if (ht || vht) {
        if (vht) s += ', VHT-MCS\xa0%d'.format(mcs);
        if (nss) s += ', VHT-NSS\xa0%d'.format(nss);
        if (ht) s += ', MCS\xa0%s'.format(mcs);
        if (sgi) s += ', ' + _('Short GI').replace(/ /g, '\xa0');
    }

    if (he) {
        s += ', HE-MCS\xa0%d'.format(mcs);
        if (nss) s += ', HE-NSS\xa0%d'.format(nss);
        if (he_gi) s += ', HE-GI\xa0%d'.format(he_gi);
        if (he_dcm) s += ', HE-DCM\xa0%d'.format(he_dcm);
    }

    return s;
}

function radio_restart(id, ev) {
    var row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(id)),
        dsc = row.querySelector('[data-name="_stat"] > div'),
        btn = row.querySelector('.cbi-section-actions button');

    btn.blur();
    btn.classList.add('spinning');
    btn.disabled = true;

    dsc.setAttribute('restart', '');
    dom.content(dsc, E('em', _('Device is restarting…')));
}

function network_updown(id, map, ev) {
    var radio = uci.get('wireless', id, 'device'),
        disabled = (uci.get('wireless', id, 'disabled') == '1') ||
        (uci.get('wireless', radio, 'disabled') == '1');

    if (disabled) {
        uci.unset('wireless', id, 'disabled');
    } else {
        uci.set('wireless', id, 'disabled', '1');

        var all_networks_disabled = true,
            wifi_ifaces = uci.sections('wireless', 'wifi-iface');

        for (var i = 0; i < wifi_ifaces.length; i++) {
            if (wifi_ifaces[i].device == radio && wifi_ifaces[i].disabled != '1') {
                all_networks_disabled = false;
                break;
            }
        }
    }

    return map.save().then(function() {
        fs.exec('/sbin/wifi_config_backup').then(
            res => { ui.changes.apply()}
        )
    });
}

function next_free_sid(offset) {

    // var sid = 'wifinet' + offset;

    // while (uci.get('wireless', sid))
    //     sid = 'wifinet' + (++offset);

    var sid = 'wifinet0';

    return sid;
}

function add_dependency_permutations(o, deps) {
    var res = null;

    for (var key in deps) {
        if (!deps.hasOwnProperty(key) || !Array.isArray(deps[key]))
            continue;

        var list = deps[key],
            tmp = [];

        for (var j = 0; j < list.length; j++) {
            for (var k = 0; k < (res ? res.length : 1); k++) {
                var item = (res ? Object.assign({}, res[k]) : {});
                item[key] = list[j];
                tmp.push(item);
            }
        }

        res = tmp;
    }

    for (var i = 0; i < (res ? res.length : 0); i++)
        o.depends(res[i]);
}

return view.extend({
    poll_status: function(map, data) {

        var rows = map.querySelectorAll('.cbi-section-table-row[data-sid]');

        for (var i = 0; i < rows.length; i++) {
            var section_id = rows[i].getAttribute('data-sid'),
                radioDev = data[1].filter(function(d) { return d.getName() == section_id })[0],
                radioNet = data[2].filter(function(n) { return n.getName() == section_id })[0],
                badge = rows[i].querySelector('[data-name="_badge"] > div'),
                stat = rows[i].querySelector('[data-name="_stat"]'),
                btns = rows[i].querySelectorAll('.cbi-section-actions button'),
                busy = btns[0].classList.contains('spinning') || btns[1].classList.contains('spinning')

            if (radioDev) {
                dom.content(badge, render_radio_badge(radioDev));
                dom.content(stat, render_radio_status(radioDev, data[2].filter(function(n) { return n.getWifiDeviceName() == radioDev.getName() })));
            } else {
                dom.content(badge, render_network_badge(radioNet));
                dom.content(stat, render_network_status(radioNet));
            }

            if (stat.hasAttribute('restart'))
                dom.content(stat, E('em', _('Device is restarting…')));

            btns[0].disabled = isReadonlyView || busy;
            btns[1].disabled = (isReadonlyView && radioDev) || busy;
        }

        var table = document.querySelector('#wifi_assoclist_table'),
            hosts = data[0],
            trows = [];

        for (var i = 0; i < data[3].length; i++) {
            var bss = data[3][i],
                name = hosts.getHostnameByMACAddr(bss.mac),
                ipv4 = hosts.getIPAddrByMACAddr(bss.mac),
                ipv6 = hosts.getIP6AddrByMACAddr(bss.mac);

            var hint;

            if (name && ipv4 && ipv6)
                hint = '%s <span class="hide-xs">(%s, %s)</span>'.format(name, ipv4, ipv6);
            else if (name && (ipv4 || ipv6))
                hint = '%s <span class="hide-xs">(%s)</span>'.format(name, ipv4 || ipv6);
            else
                hint = name || ipv4 || ipv6 || '?';

            var row = [
                E('span', {
                    'class': 'ifacebadge',
                    'data-ifname': bss.network.getIfname(),
                    'data-ssid': bss.network.getSSID()
                }, [
                    E('img', {
                        'src': L.resource('icons/wifi%s.png').format(bss.network.isUp() ? '' : '_disabled'),
                        'title': bss.radio.getI18n()
                    }),
                    E('span', [
                        ' %s '.format(bss.network.getShortName()),
                        E('small', '(%s)'.format(bss.network.getIfname()))
                    ])
                ]),
                bss.mac,
                hint,
                render_signal_badge(Math.min((bss.signal + 110) / 70 * 100, 100), bss.signal, bss.noise),
                E('span', {}, [
                    E('span', format_wifirate(bss.rx)),
                    E('br'),
                    E('span', format_wifirate(bss.tx))
                ])
            ];

            if (bss.network.isClientDisconnectSupported()) {
                if (table.firstElementChild.childNodes.length < 6)
                    table.firstElementChild.appendChild(E('th', { 'class': 'th cbi-section-actions' }));

                row.push(E('button', {
                    'class': 'cbi-button cbi-button-remove',
                    'click': L.bind(function(net, mac, ev) {
                        dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
                        ev.currentTarget.classList.add('spinning');
                        ev.currentTarget.disabled = true;
                        ev.currentTarget.blur();

                        net.disconnectClient(mac, true, 5, 60000);
                    }, this, bss.network, bss.mac),
                    'disabled': isReadonlyView || null
                }, [_('Disconnect')]));
            } else {
                row.push('-');
            }

            trows.push(row);
        }

        cbi_update_table(table, trows, E('em', _('No information available')));

        var stat = document.querySelector('.cbi-modal [data-name="_wifistat_modal"] .ifacebadge.large');

        if (stat)
            render_modal_status(stat, data[2].filter(function(n) { return n.getName() == stat.getAttribute('data-network') })[0]);

        return network.flushCache();
    },

    awaitgetWifiState: function(/* ... */) {
        var isOnRequest = true; 

		window.setTimeout(L.bind(function() {
			poll.add(L.bind(function() {
				var tasks = [], isOnRequest = true;;

				tasks.push(callWifiState().then(function(data){
                    console.log(data);
                    if(data['state'] == 'invalid'  || data['state'] == 'timeout'){
                        ui.addNotification(null, E('p', _('Cannot connect to this network, please check the configuration')), 'danger');
                        callWifiState('unkonw');
                        //document.getElementById('cbi-wireless-wifinet0').remove();
                        window.setTimeout(function(){
                                window.location.reload();
                        }, 2000);
                    }
                    if(data['state'] != 'connecting'){
                        isConnecting = false;
                    }
                    isOnRequest = false;
                }));

				return Promise.all(tasks).then(function() {
					if (!isConnecting && !isOnRequest) {
						poll.stop();
					}
				});
			}, this));
		}, this), 1);
	},

    load: function() {
      
        this.awaitgetWifiState();
        
        return Promise.all([
            uci.changes(),
            uci.load('wireless'),
            
        ]);
    },

    render: function() {
        return this.renderOverview();
    },

    renderOverview: function() {
        var m, s, o;

        m = new form.Map('wireless');
        m.chain('network');
        m.chain('firewall');

        s = m.section(form.GridSection, 'wifi-device', _('Wireless'));
        s.anonymous = true;
        s.addremove = false;

        s.load = function() {
            return network.getWifiDevices().then(L.bind(function(radios) {
                this.radios = radios.sort(function(a, b) {
                    return a.getName() > b.getName();
                });

                var tasks = [];

                for (var i = 0; i < radios.length; i++)
                    tasks.push(radios[i].getWifiNetworks());

                return Promise.all(tasks);
            }, this)).then(L.bind(function(data) {
                this.wifis = [];

                for (var i = 0; i < data.length; i++)
                    this.wifis.push.apply(this.wifis, data[i]);
            }, this));
        };

        s.cfgsections = function() {
            var rv = [];

            for (var i = 0; i < this.radios.length; i++) {
                rv.push(this.radios[i].getName());

                for (var j = 0; j < this.wifis.length; j++)
                    if (this.wifis[j].getWifiDeviceName() == this.radios[i].getName() && this.wifis[j].getActiveMode() != 'Master')
                        rv.push(this.wifis[j].getName());
            }

            return rv;
        };

        s.modaltitle = function(section_id) {
            var radioNet = this.wifis.filter(function(w) { return w.getName() == section_id })[0];
            return radioNet ? radioNet.getI18n() : _('Edit wireless network');
        };

        s.lookupRadioOrNetwork = function(section_id) {
            var radioDev = this.radios.filter(function(r) { return r.getName() == section_id })[0];
            if (radioDev)
                return radioDev;

            var radioNet = this.wifis.filter(function(w) { return w.getName() == section_id })[0];
            if (radioNet)
                return radioNet;

            return null;
        };

        s.renderRowActions = function(section_id) {
            var inst = this.lookupRadioOrNetwork(section_id),
                btns;

            if (inst.getWifiNetworks) {
                btns = [
                    E('button', {
                        'class': 'cbi-button cbi-button-neutral',
                        'title': _('Restart radio interface'),
                        'click': ui.createHandlerFn(this, radio_restart, section_id)
                    }, _('Restart')),
                    E('button', {
                        'class': 'cbi-button cbi-button-action important',
                        'title': _('Find and join network'),
                        'click': ui.createHandlerFn(this, 'handleScan', inst)
                    }, _('Scan'))
                ];
            } else {
                var isDisabled = (inst.get('disabled') == '1' ||
                    uci.get('wireless', inst.getWifiDeviceName(), 'disabled') == '1');

                btns = [
                    E('button', {
                        'class': 'cbi-button cbi-button-neutral enable-disable',
                        'title': isDisabled ? _('Enable this network') : _('Disable this network'),
                        'click': ui.createHandlerFn(this, network_updown, section_id, this.map)
                    }, isDisabled ? _('Enable') : _('Disable')),
                    E('button', {
                        'class': 'cbi-button cbi-button-action important',
                        'title': _('Edit this network'),
                        'click': ui.createHandlerFn(this, 'renderMoreOptionsModal', section_id)
                    }, _('Edit'))
                ];
            }

            return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
        };

        s.addModalOptions = function(s) {
            return network.getWifiNetwork(s.section).then(function(radioNet) {
                var hwtype = uci.get('wireless', radioNet.getWifiDeviceName(), 'type');
                var o, ss;

                o = s.option(form.SectionValue, '_device', form.NamedSection, radioNet.getName(), 'wifi-iface', _('Interface Configuration'));
                o.modalonly = true;

                ss = o.subsection;
                ss.tab('general', _('General Setup'));
                ss.tab('encryption', _('Wireless Security'));

                o = ss.taboption('general', form.ListValue, 'mode', _('Mode'));
                o.value('sta', _('Client'));
                

                o = ss.taboption('general', form.Value, 'ssid', _('<abbr title="Extended Service Set Identifier">ESSID</abbr>'));
                o.datatype = 'maxlength(32)';
                o.depends('mode', 'sta');

                o = ss.taboption('general', form.Value, 'bssid', _('<abbr title="Basic Service Set Identifier">BSSID</abbr>'));
                o.datatype = 'macaddr';

                if (hwtype == 'mac80211') {
                    var mode = ss.children[0],
                        bssid = ss.children[5],
                        encr;
                }


                encr = o = ss.taboption('encryption', form.ListValue, 'encryption', _('Encryption'));
                o.depends('mode', 'sta');

                o.cfgvalue = function(section_id) {
                    var v = String(uci.get('wireless', section_id, 'encryption'));
                    if (v == 'wep')
                        return 'wep-open';
                    else if (v.match(/\+/))
                        return v.replace(/\+.+$/, '');
                    return v;
                };

                o.write = function(section_id, value) {
                    var e = this.section.children.filter(function(o) { return o.option == 'encryption' })[0].formvalue(section_id),
                        co = this.section.children.filter(function(o) { return o.option == 'cipher' })[0],
                        c = co.formvalue(section_id);

                    if (value == 'wpa' || value == 'wpa2' || value == 'wpa3' || value == 'wpa3-mixed')
                        uci.unset('wireless', section_id, 'key');

                    if (co.isActive(section_id) && e && (c == 'tkip' || c == 'ccmp' || c == 'tkip+ccmp'))
                        e += '+' + c;

                    uci.set('wireless', section_id, 'encryption', e);
                };

                o = ss.taboption('encryption', form.ListValue, 'cipher', _('Cipher'));
                o.depends('encryption', 'wpa');
                o.depends('encryption', 'wpa2');
                o.depends('encryption', 'wpa3');
                o.depends('encryption', 'wpa3-mixed');
                o.depends('encryption', 'psk');
                o.depends('encryption', 'psk2');
                o.depends('encryption', 'wpa-mixed');
                o.depends('encryption', 'psk-mixed');
                o.value('auto', _('auto'));
                o.value('ccmp', _('Force CCMP (AES)'));
                o.value('tkip', _('Force TKIP'));
                o.value('tkip+ccmp', _('Force TKIP and CCMP (AES)'));
                o.write = ss.children.filter(function(o) { return o.option == 'encryption' })[0].write;

                o.cfgvalue = function(section_id) {
                    var v = String(uci.get('wireless', section_id, 'encryption'));
                    if (v.match(/\+/)) {
                        v = v.replace(/^[^+]+\+/, '');
                        if (v == 'aes')
                            v = 'ccmp';
                        else if (v == 'tkip+aes' || v == 'aes+tkip' || v == 'ccmp+tkip')
                            v = 'tkip+ccmp';
                    }
                    return v;
                };


                var crypto_modes = [];

                if (hwtype == 'mac80211') {
                    var has_supplicant = L.hasSystemFeature('wpasupplicant'),
                        has_hostapd = L.hasSystemFeature('hostapd');

                    // Probe EAP support
                    var has_ap_eap = L.hasSystemFeature('hostapd', 'eap'),
                        has_sta_eap = L.hasSystemFeature('wpasupplicant', 'eap');

                    // Probe SAE support
                    var has_ap_sae = L.hasSystemFeature('hostapd', 'sae'),
                        has_sta_sae = L.hasSystemFeature('wpasupplicant', 'sae');

                    // Probe OWE support
                    var has_ap_owe = L.hasSystemFeature('hostapd', 'owe'),
                        has_sta_owe = L.hasSystemFeature('wpasupplicant', 'owe');

                    // Probe Suite-B support
                    var has_ap_eap192 = L.hasSystemFeature('hostapd', 'suiteb192'),
                        has_sta_eap192 = L.hasSystemFeature('wpasupplicant', 'suiteb192');

                    // Probe WEP support
                    var has_ap_wep = L.hasSystemFeature('hostapd', 'wep'),
                        has_sta_wep = L.hasSystemFeature('wpasupplicant', 'wep');

                    if (has_hostapd || has_supplicant) {
                        crypto_modes.push(['psk2', 'WPA2-PSK', 35]);
                        crypto_modes.push(['psk-mixed', 'WPA-PSK/WPA2-PSK Mixed Mode', 22]);
                        crypto_modes.push(['psk', 'WPA-PSK', 21]);
                    } else {
                        encr.description = _('WPA-Encryption requires wpa_supplicant (for client mode) or hostapd (for AP and ad-hoc mode) to be installed.');
                    }

                    if (has_ap_sae || has_sta_sae) {
                        crypto_modes.push(['sae', 'WPA3-SAE', 31]);
                        crypto_modes.push(['sae-mixed', 'WPA2-PSK/WPA3-SAE Mixed Mode', 30]);
                    }

                    if (has_ap_wep || has_sta_wep) {
                        crypto_modes.push(['wep-open', _('WEP Open System'), 11]);
                        crypto_modes.push(['wep-shared', _('WEP Shared Key'), 10]);
                    }

                    if (has_ap_eap || has_sta_eap) {
                        if (has_ap_eap192 || has_sta_eap192) {
                            crypto_modes.push(['wpa3', 'WPA3-EAP', 33]);
                            crypto_modes.push(['wpa3-mixed', 'WPA2-EAP/WPA3-EAP Mixed Mode', 32]);
                        }

                        crypto_modes.push(['wpa2', 'WPA2-EAP', 34]);
                        crypto_modes.push(['wpa', 'WPA-EAP', 20]);
                    }

                    if (has_ap_owe || has_sta_owe) {
                        crypto_modes.push(['owe', 'OWE', 1]);
                    }

                    encr.crypto_support = {
                        'ap': {
                            'wep-open': has_ap_wep || _('Requires hostapd with WEP support'),
                            'wep-shared': has_ap_wep || _('Requires hostapd with WEP support'),
                            'psk': has_hostapd || _('Requires hostapd'),
                            'psk2': has_hostapd || _('Requires hostapd'),
                            'psk-mixed': has_hostapd || _('Requires hostapd'),
                            'sae': has_ap_sae || _('Requires hostapd with SAE support'),
                            'sae-mixed': has_ap_sae || _('Requires hostapd with SAE support'),
                            'wpa': has_ap_eap || _('Requires hostapd with EAP support'),
                            'wpa2': has_ap_eap || _('Requires hostapd with EAP support'),
                            'wpa3': has_ap_eap192 || _('Requires hostapd with EAP Suite-B support'),
                            'wpa3-mixed': has_ap_eap192 || _('Requires hostapd with EAP Suite-B support'),
                            'owe': has_ap_owe || _('Requires hostapd with OWE support')
                        },
                        'sta': {
                            'wep-open': has_sta_wep || _('Requires wpa-supplicant with WEP support'),
                            'wep-shared': has_sta_wep || _('Requires wpa-supplicant with WEP support'),
                            'psk': has_supplicant || _('Requires wpa-supplicant'),
                            'psk2': has_supplicant || _('Requires wpa-supplicant'),
                            'psk-mixed': has_supplicant || _('Requires wpa-supplicant'),
                            'sae': has_sta_sae || _('Requires wpa-supplicant with SAE support'),
                            'sae-mixed': has_sta_sae || _('Requires wpa-supplicant with SAE support'),
                            'wpa': has_sta_eap || _('Requires wpa-supplicant with EAP support'),
                            'wpa2': has_sta_eap || _('Requires wpa-supplicant with EAP support'),
                            'wpa3': has_sta_eap192 || _('Requires wpa-supplicant with EAP Suite-B support'),
                            'wpa3-mixed': has_sta_eap192 || _('Requires wpa-supplicant with EAP Suite-B support'),
                            'owe': has_sta_owe || _('Requires wpa-supplicant with OWE support')
                        },
                        'adhoc': {
                            'wep-open': true,
                            'wep-shared': true,
                            'psk': has_supplicant || _('Requires wpa-supplicant'),
                            'psk2': has_supplicant || _('Requires wpa-supplicant'),
                            'psk-mixed': has_supplicant || _('Requires wpa-supplicant'),
                        },
                        'mesh': {
                            'sae': has_sta_sae || _('Requires wpa-supplicant with SAE support')
                        },
                        'ahdemo': {
                            'wep-open': true,
                            'wep-shared': true
                        },
                        'wds': {
                            'wep-open': true,
                            'wep-shared': true
                        }
                    };

                    encr.crypto_support['sta-wds'] = encr.crypto_support['sta'];

                    encr.validate = function(section_id, value) {
                        var modeopt = this.section.children.filter(function(o) { return o.option == 'mode' })[0],
                            modeval = modeopt.formvalue(section_id),
                            modetitle = modeopt.vallist[modeopt.keylist.indexOf(modeval)],
                            enctitle = this.vallist[this.keylist.indexOf(value)];

                        if (value == 'none')
                            return true;

                        if (!L.isObject(this.crypto_support[modeval]) || !this.crypto_support[modeval].hasOwnProperty(value))
                            return _('The selected %s mode is incompatible with %s encryption').format(modetitle, enctitle);

                        return this.crypto_support[modeval][value];
                    };
                } else if (hwtype == 'broadcom') {
                    crypto_modes.push(['psk2', 'WPA2-PSK', 33]);
                    crypto_modes.push(['psk+psk2', 'WPA-PSK/WPA2-PSK Mixed Mode', 22]);
                    crypto_modes.push(['psk', 'WPA-PSK', 21]);
                    crypto_modes.push(['wep-open', _('WEP Open System'), 11]);
                    crypto_modes.push(['wep-shared', _('WEP Shared Key'), 10]);
                }

                crypto_modes.push(['none', _('No Encryption'), 0]);

                crypto_modes.sort(function(a, b) { return b[2] - a[2] });

                for (var i = 0; i < crypto_modes.length; i++) {
                    var security_level = (crypto_modes[i][2] >= 30) ? _('strong security') :
                        (crypto_modes[i][2] >= 20) ? _('medium security') :
                        (crypto_modes[i][2] >= 10) ? _('weak security') : _('open network');

                    encr.value(crypto_modes[i][0], '%s (%s)'.format(crypto_modes[i][1], security_level));
                }

                o = ss.taboption('encryption', form.Value, '_wpa_key', _('Key'));
                o.depends('encryption', 'psk');
                o.depends('encryption', 'psk2');
                o.depends('encryption', 'psk+psk2');
                o.depends('encryption', 'psk-mixed');
                o.depends('encryption', 'sae');
                o.depends('encryption', 'sae-mixed');
                o.datatype = 'wpakey';
                o.rmempty = true;
                o.password = true;

                o.cfgvalue = function(section_id) {
                    var key = uci.get('wireless', section_id, 'key');
                    return /^[1234]$/.test(key) ? null : key;
                };

                o.write = function(section_id, value) {
                    uci.set('wireless', section_id, 'key', value);
                    uci.unset('wireless', section_id, 'key1');
                    uci.unset('wireless', section_id, 'key2');
                    uci.unset('wireless', section_id, 'key3');
                    uci.unset('wireless', section_id, 'key4');
                };


                o = ss.taboption('encryption', form.ListValue, '_wep_key', _('Used Key Slot'));
                o.depends('encryption', 'wep-open');
                o.depends('encryption', 'wep-shared');
                o.value('1', _('Key #%d').format(1));
                o.value('2', _('Key #%d').format(2));
                o.value('3', _('Key #%d').format(3));
                o.value('4', _('Key #%d').format(4));

                o.cfgvalue = function(section_id) {
                    var slot = +uci.get('wireless', section_id, 'key');
                    return (slot >= 1 && slot <= 4) ? String(slot) : '';
                };

                o.write = function(section_id, value) {
                    uci.set('wireless', section_id, 'key', value);
                };

                for (var slot = 1; slot <= 4; slot++) {
                    o = ss.taboption('encryption', form.Value, 'key%d'.format(slot), _('Key #%d').format(slot));
                    o.depends('encryption', 'wep-open');
                    o.depends('encryption', 'wep-shared');
                    o.datatype = 'wepkey';
                    o.rmempty = true;
                    o.password = true;

                    o.write = function(section_id, value) {
                        if (value != null && (value.length == 5 || value.length == 13))
                            value = 's:%s'.format(value);
                        uci.set('wireless', section_id, this.option, value);
                    };
                }


                if (hwtype == 'mac80211') {
                    // Probe 802.11r support (and EAP support as a proxy for Openwrt)
                    var has_80211r = L.hasSystemFeature('hostapd', '11r') || L.hasSystemFeature('hostapd', 'eap');

                    o = ss.taboption('encryption', form.Flag, 'ieee80211r', _('802.11r Fast Transition'), _('Enables fast roaming among access points that belong to the same Mobility Domain'));
                    add_dependency_permutations(o, { mode: ['ap', 'ap-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });
                    if (has_80211r)
                        add_dependency_permutations(o, { mode: ['ap', 'ap-wds'], encryption: ['psk', 'psk2', 'psk-mixed', 'sae', 'sae-mixed'] });
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Value, 'nasid', _('NAS ID'), _('Used for two different purposes: RADIUS NAS ID and 802.11r R0KH-ID. Not needed with normal WPA(2)-PSK.'));
                    add_dependency_permutations(o, { mode: ['ap', 'ap-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });
                    o.depends({ ieee80211r: '1' });
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Value, 'mobility_domain', _('Mobility Domain'), _('4-character hexadecimal ID'));
                    o.depends({ ieee80211r: '1' });
                    o.placeholder = '4f57';
                    o.datatype = 'and(hexstring,length(4))';
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Value, 'reassociation_deadline', _('Reassociation Deadline'), _('time units (TUs / 1.024 ms) [1000-65535]'));
                    o.depends({ ieee80211r: '1' });
                    o.placeholder = '1000';
                    o.datatype = 'range(1000,65535)';
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.ListValue, 'ft_over_ds', _('FT protocol'));
                    o.depends({ ieee80211r: '1' });
                    o.value('1', _('FT over DS'));
                    o.value('0', _('FT over the Air'));
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Flag, 'ft_psk_generate_local', _('Generate PMK locally'), _('When using a PSK, the PMK can be automatically generated. When enabled, the R0/R1 key options below are not applied. Disable this to use the R0 and R1 key options.'));
                    o.depends({ ieee80211r: '1' });
                    o.default = o.enabled;
                    o.rmempty = false;

                    o = ss.taboption('encryption', form.Value, 'r0_key_lifetime', _('R0 Key Lifetime'), _('minutes'));
                    o.depends({ ieee80211r: '1' });
                    o.placeholder = '10000';
                    o.datatype = 'uinteger';
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Value, 'r1_key_holder', _('R1 Key Holder'), _('6-octet identifier as a hex string - no colons'));
                    o.depends({ ieee80211r: '1' });
                    o.placeholder = '00004f577274';
                    o.datatype = 'and(hexstring,length(12))';
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.Flag, 'pmk_r1_push', _('PMK R1 Push'));
                    o.depends({ ieee80211r: '1' });
                    o.placeholder = '0';
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.DynamicList, 'r0kh', _('External R0 Key Holder List'), _('List of R0KHs in the same Mobility Domain. <br />Format: MAC-address,NAS-Identifier,128-bit key as hex string. <br />This list is used to map R0KH-ID (NAS Identifier) to a destination MAC address when requesting PMK-R1 key from the R0KH that the STA used during the Initial Mobility Domain Association.'));
                    o.depends({ ieee80211r: '1' });
                    o.rmempty = true;

                    o = ss.taboption('encryption', form.DynamicList, 'r1kh', _('External R1 Key Holder List'), _('List of R1KHs in the same Mobility Domain. <br />Format: MAC-address,R1KH-ID as 6 octets with colons,128-bit key as hex string. <br />This list is used to map R1KH-ID to a destination MAC address when sending PMK-R1 key from the R0KH. This is also the list of authorized R1KHs in the MD that can request PMK-R1 keys.'));
                    o.depends({ ieee80211r: '1' });
                    o.rmempty = true;
                    // End of 802.11r options

                    o = ss.taboption('encryption', form.ListValue, 'eap_type', _('EAP-Method'));
                    o.value('tls', 'TLS');
                    o.value('ttls', 'TTLS');
                    o.value('peap', 'PEAP');
                    o.value('fast', 'FAST');
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                    o = ss.taboption('encryption', form.Flag, 'ca_cert_usesystem', _('Use system certificates'), _("Validate server certificate using built-in system CA bundle,<br />requires the \"ca-bundle\" package"));
                    o.enabled = '1';
                    o.disabled = '0';
                    o.default = o.disabled;
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });
                    o.validate = function(section_id, value) {
                        if (value == '1' && !L.hasSystemFeature('cabundle')) {
                            return _("This option cannot be used because the ca-bundle package is not installed.");
                        }
                        return true;
                    };

                    o = ss.taboption('encryption', form.FileUpload, 'ca_cert', _('Path to CA-Certificate'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], ca_cert_usesystem: ['0'] });

                    o = ss.taboption('encryption', form.Value, 'subject_match', _('Certificate constraint (Subject)'), _("Certificate constraint substring - e.g. /CN=wifi.mycompany.com<br />See `logread -f` during handshake for actual values"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                    o = ss.taboption('encryption', form.DynamicList, 'altsubject_match', _('Certificate constraint (SAN)'), _("Certificate constraint(s) via Subject Alternate Name values<br />(supported attributes: EMAIL, DNS, URI) - e.g. DNS:wifi.mycompany.com"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                    o = ss.taboption('encryption', form.DynamicList, 'domain_match', _('Certificate constraint (Domain)'), _("Certificate constraint(s) against DNS SAN values (if available)<br />or Subject CN (exact match)"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                    o = ss.taboption('encryption', form.DynamicList, 'domain_suffix_match', _('Certificate constraint (Wildcard)'), _("Certificate constraint(s) against DNS SAN values (if available)<br />or Subject CN (suffix match)"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                    o = ss.taboption('encryption', form.FileUpload, 'client_cert', _('Path to Client-Certificate'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['tls'] });

                    o = ss.taboption('encryption', form.FileUpload, 'priv_key', _('Path to Private Key'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['tls'] });

                    o = ss.taboption('encryption', form.Value, 'priv_key_pwd', _('Password of Private Key'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['tls'] });
                    o.password = true;

                    o = ss.taboption('encryption', form.ListValue, 'auth', _('Authentication'));
                    o.value('PAP', 'PAP');
                    o.value('CHAP', 'CHAP');
                    o.value('MSCHAP', 'MSCHAP');
                    o.value('MSCHAPV2', 'MSCHAPv2');
                    o.value('EAP-GTC', 'EAP-GTC');
                    o.value('EAP-MD5', 'EAP-MD5');
                    o.value('EAP-MSCHAPV2', 'EAP-MSCHAPv2');
                    o.value('EAP-TLS', 'EAP-TLS');
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['fast', 'peap', 'ttls'] });

                    o.validate = function(section_id, value) {
                        var eo = this.section.children.filter(function(o) { return o.option == 'eap_type' })[0],
                            ev = eo.formvalue(section_id);

                        if (ev != 'ttls' && (value == 'PAP' || value == 'CHAP' || value == 'MSCHAP' || value == 'MSCHAPV2'))
                            return _('This authentication type is not applicable to the selected EAP method.');

                        return true;
                    };

                    o = ss.taboption('encryption', form.Flag, 'ca_cert2_usesystem', _('Use system certificates for inner-tunnel'), _("Validate server certificate using built-in system CA bundle,<br />requires the \"ca-bundle\" package"));
                    o.enabled = '1';
                    o.disabled = '0';
                    o.default = o.disabled;
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });
                    o.validate = function(section_id, value) {
                        if (value == '1' && !L.hasSystemFeature('cabundle')) {
                            return _("This option cannot be used because the ca-bundle package is not installed.");
                        }
                        return true;
                    };

                    o = ss.taboption('encryption', form.FileUpload, 'ca_cert2', _('Path to inner CA-Certificate'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'], ca_cert2_usesystem: ['0'] });

                    o = ss.taboption('encryption', form.Value, 'subject_match2', _('Inner certificate constraint (Subject)'), _("Certificate constraint substring - e.g. /CN=wifi.mycompany.com<br />See `logread -f` during handshake for actual values"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.DynamicList, 'altsubject_match2', _('Inner certificate constraint (SAN)'), _("Certificate constraint(s) via Subject Alternate Name values<br />(supported attributes: EMAIL, DNS, URI) - e.g. DNS:wifi.mycompany.com"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.DynamicList, 'domain_match2', _('Inner certificate constraint (Domain)'), _("Certificate constraint(s) against DNS SAN values (if available)<br />or Subject CN (exact match)"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.DynamicList, 'domain_suffix_match2', _('Inner certificate constraint (Wildcard)'), _("Certificate constraint(s) against DNS SAN values (if available)<br />or Subject CN (suffix match)"));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.FileUpload, 'client_cert2', _('Path to inner Client-Certificate'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.FileUpload, 'priv_key2', _('Path to inner Private Key'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });

                    o = ss.taboption('encryption', form.Value, 'priv_key2_pwd', _('Password of inner Private Key'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], auth: ['EAP-TLS'] });
                    o.password = true;

                    o = ss.taboption('encryption', form.Value, 'identity', _('Identity'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['fast', 'peap', 'tls', 'ttls'] });

                    o = ss.taboption('encryption', form.Value, 'anonymous_identity', _('Anonymous Identity'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['fast', 'peap', 'tls', 'ttls'] });

                    o = ss.taboption('encryption', form.Value, 'password', _('Password'));
                    add_dependency_permutations(o, { mode: ['sta', 'sta-wds'], encryption: ['wpa', 'wpa2', 'wpa3', 'wpa3-mixed'], eap_type: ['fast', 'peap', 'ttls'] });
                    o.password = true;


                    if (hwtype == 'mac80211') {
                        // ieee802.11w options
                        o = ss.taboption('encryption', form.ListValue, 'ieee80211w', _('802.11w Management Frame Protection'), _("Note: Some wireless drivers do not fully support 802.11w. E.g. mwlwifi may have problems"));
                        o.value('', _('Disabled'));
                        o.value('1', _('Optional'));
                        o.value('2', _('Required'));
                        add_dependency_permutations(o, { mode: ['ap', 'ap-wds', 'sta', 'sta-wds'], encryption: ['owe', 'psk2', 'psk-mixed', 'sae', 'sae-mixed', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                        o.defaults = {
                            '2': [{ encryption: 'sae' }, { encryption: 'owe' }, { encryption: 'wpa3' }, { encryption: 'wpa3-mixed' }],
                            '1': [{ encryption: 'sae-mixed' }],
                            '': []
                        };

                        o = ss.taboption('encryption', form.Value, 'ieee80211w_max_timeout', _('802.11w maximum timeout'), _('802.11w Association SA Query maximum timeout'));
                        o.depends('ieee80211w', '1');
                        o.depends('ieee80211w', '2');
                        o.datatype = 'uinteger';
                        o.placeholder = '1000';
                        o.rmempty = true;

                        o = ss.taboption('encryption', form.Value, 'ieee80211w_retry_timeout', _('802.11w retry timeout'), _('802.11w Association SA Query retry timeout'));
                        o.depends('ieee80211w', '1');
                        o.depends('ieee80211w', '2');
                        o.datatype = 'uinteger';
                        o.placeholder = '201';
                        o.rmempty = true;

                        o = ss.taboption('encryption', form.Flag, 'wpa_disable_eapol_key_retries', _('Enable key reinstallation (KRACK) countermeasures'), _('Complicates key reinstallation attacks on the client side by disabling retransmission of EAPOL-Key frames that are used to install keys. This workaround might cause interoperability issues and reduced robustness of key negotiation especially in environments with heavy traffic load.'));
                        add_dependency_permutations(o, { mode: ['ap', 'ap-wds'], encryption: ['psk2', 'psk-mixed', 'sae', 'sae-mixed', 'wpa2', 'wpa3', 'wpa3-mixed'] });

                        if (L.hasSystemFeature('hostapd', 'wps') && L.hasSystemFeature('wpasupplicant')) {
                            o = ss.taboption('encryption', form.Flag, 'wps_pushbutton', _('Enable WPS pushbutton, requires WPA(2)-PSK/WPA3-SAE'))
                            o.enabled = '1';
                            o.disabled = '0';
                            o.default = o.disabled;
                            o.depends('encryption', 'psk');
                            o.depends('encryption', 'psk2');
                            o.depends('encryption', 'psk-mixed');
                            o.depends('encryption', 'sae');
                            o.depends('encryption', 'sae-mixed');
                        }
                    }
                }
            });
        };

        s.handleScan = function(radioDev, ev) {
            var table = E('table', { 'class': 'table' }, [
                E('tr', { 'class': 'tr table-titles' }, [
                    E('th', { 'class': 'th col-2 middle center' }, _('Signal')),
                    E('th', { 'class': 'th col-4 middle left' }, _('SSID')),
                    E('th', { 'class': 'th col-2 middle center hide-xs' }, _('Channel')),
                    E('th', { 'class': 'th col-2 middle left hide-xs' }, _('Mode')),
                    E('th', { 'class': 'th col-3 middle left hide-xs' }, _('BSSID')),
                    E('th', { 'class': 'th col-3 middle left' }, _('Encryption')),
                    E('th', { 'class': 'th cbi-section-actions right' }, ' '),
                ])
            ]);

            var stop = E('button', {
                'class': 'btn',
                'click': L.bind(this.handleScanStartStop, this),
                'style': 'display:none',
                'data-state': 'stop'
            }, _('Stop refresh'));

            cbi_update_table(table, [], E('em', { class: 'spinning' }, _('Starting wireless scan...')));

            var md = ui.showModal(_('Join Network: Wireless Scan'), [
                table,
                E('div', { 'class': 'right' }, [
                    stop,
                    ' ',
                    E('button', {
                        'class': 'btn',
                        'click': L.bind(this.handleScanAbort, this)
                    }, _('Dismiss'))
                ])
            ]);

            md.style.maxWidth = '90%';
            md.style.maxHeight = 'none';

            this.pollFn = L.bind(this.handleScanRefresh, this, radioDev, {}, table, stop);

            poll.add(this.pollFn);
            poll.start();
        };

        s.handleScanRefresh = function(radioDev, scanCache, table, stop) {
            return radioDev.getScanList().then(L.bind(function(results) {
                var rows = [];

                for (var i = 0; i < results.length; i++)
                    scanCache[results[i].bssid] = results[i];

                for (var k in scanCache)
                    if (scanCache[k].stale)
                        results.push(scanCache[k]);

                results.sort(function(a, b) {
                    var diff = (b.quality - a.quality) || (a.channel - b.channel);

                    if (diff)
                        return diff;

                    if (a.ssid < b.ssid)
                        return -1;
                    else if (a.ssid > b.ssid)
                        return 1;

                    if (a.bssid < b.bssid)
                        return -1;
                    else if (a.bssid > b.bssid)
                        return 1;
                });

                for (var i = 0; i < results.length; i++) {
                    var res = results[i],
                        qv = res.quality || 0,
                        qm = res.quality_max || 0,
                        q = (qv > 0 && qm > 0) ? Math.floor((100 / qm) * qv) : 0,
                        s = res.stale ? 'opacity:0.5' : '';

                    rows.push([
                        E('span', { 'style': s }, render_signal_badge(q, res.signal, res.noise)),
                        E('span', { 'style': s }, (res.ssid != null) ? '%h'.format(res.ssid) : E('em', _('hidden'))),
                        E('span', { 'style': s }, '%d'.format(res.channel)),
                        E('span', { 'style': s }, '%h'.format(res.mode)),
                        E('span', { 'style': s }, '%h'.format(res.bssid)),
                        E('span', { 'style': s }, '%h'.format(network.formatWifiEncryption(res.encryption))),
                        E('div', { 'class': 'right' }, E('button', {
                            'class': 'cbi-button cbi-button-action important',
                            'click': ui.createHandlerFn(this, 'handleJoin', radioDev, res)
                        }, _('Join Network')))
                    ]);

                    res.stale = true;
                }

                cbi_update_table(table, rows);

                stop.disabled = false;
                stop.style.display = '';
                stop.classList.remove('spinning');
            }, this));
        };

        s.handleScanStartStop = function(ev) {
            var btn = ev.currentTarget;

            if (btn.getAttribute('data-state') == 'stop') {
                poll.remove(this.pollFn);
                btn.firstChild.data = _('Start refresh');
                btn.setAttribute('data-state', 'start');
            } else {
                poll.add(this.pollFn);
                btn.firstChild.data = _('Stop refresh');
                btn.setAttribute('data-state', 'stop');
                btn.classList.add('spinning');
                btn.disabled = true;
            }
        };

        s.handleScanAbort = function(ev) {
            var md = dom.parent(ev.target, 'div[aria-modal="true"]');
            if (md) {
                md.style.maxWidth = '';
                md.style.maxHeight = '';
            }

            ui.hideModal();
            poll.remove(this.pollFn);

            this.pollFn = null;
        };

        s.handleJoinConfirm = function(radioDev, bss, form, ev) {
            var nameopt = L.toArray(form.lookupOption('name', '_new_'))[0],
                passopt = L.toArray(form.lookupOption('password', '_new_'))[0],
                ssidopt = L.toArray(form.lookupOption('ssid', '_new_'))[0],
                bssidopt = L.toArray(form.lookupOption('bssid', '_new_'))[0],
                replopt = L.toArray(form.lookupOption('replace', '_new_'))[0],
                nameval = (nameopt && nameopt.isValid('_new_')) ? nameopt.formvalue('_new_') : null,
                passval = (passopt && passopt.isValid('_new_')) ? passopt.formvalue('_new_') : null,
                ssidval = (ssidopt && ssidopt.isValid('_new_')) ? ssidopt.formvalue('_new_') : null,
                bssidval = (bssidopt && bssidopt.isValid('_new_')) ? bssidopt.formvalue('_new_') : null,
                enc = L.isObject(bss.encryption) ? bss.encryption : null,
                is_wep = (enc && Array.isArray(enc.wep)),
                is_psk = (enc && Array.isArray(enc.wpa) && L.toArray(enc.authentication).filter(function(a) { return a == 'psk' }).length > 0),
                is_sae = (enc && Array.isArray(enc.wpa) && L.toArray(enc.authentication).filter(function(a) { return a == 'sae' }).length > 0);

            if (nameval == null || (passopt && passval == null))
                return;

            var section_id = null;

            return this.map.save(function() {
                var wifi_sections = uci.sections('wireless', 'wifi-iface');

                if (uci.get('wireless', radioDev.getName(), 'disabled') == '1') {
                    for (var i = 0; i < wifi_sections.length; i++)
                        if (wifi_sections[i].device == radioDev.getName())
                            uci.set('wireless', wifi_sections[i]['.name'], 'disabled', '1');

                    uci.unset('wireless', radioDev.getName(), 'disabled');
                }

                section_id = next_free_sid(wifi_sections.length);

                uci.add('wireless', 'wifi-iface', section_id);
                uci.set('wireless', section_id, 'device', radioDev.getName());
                uci.set('wireless', section_id, 'mode', (bss.mode == 'Ad-Hoc') ? 'adhoc' : 'sta');
                uci.set('wireless', section_id, 'network', nameval);

                if (bss.ssid != null) {
                    uci.set('wireless', section_id, 'ssid', bss.ssid);

                    if (bssidval == '1')
                        uci.set('wireless', section_id, 'bssid', bss.bssid);
                } else if (bss.bssid != null) {
                    uci.set('wireless', section_id, 'bssid', bss.bssid);
                }

                if (ssidval != null)
                    uci.set('wireless', section_id, 'ssid', ssidval);

                if (is_sae) {
                    uci.set('wireless', section_id, 'encryption', 'sae');
                    uci.set('wireless', section_id, 'key', passval);
                } else if (is_psk) {
                    for (var i = enc.wpa.length - 1; i >= 0; i--) {
                        if (enc.wpa[i] == 2) {
                            uci.set('wireless', section_id, 'encryption', 'psk2');
                            break;
                        } else if (enc.wpa[i] == 1) {
                            uci.set('wireless', section_id, 'encryption', 'psk');
                            break;
                        }
                    }

                    uci.set('wireless', section_id, 'key', passval);
                } else if (is_wep) {
                    uci.set('wireless', section_id, 'encryption', 'wep-open');
                    uci.set('wireless', section_id, 'key', '1');
                    uci.set('wireless', section_id, 'key1', passval);
                } else {
                    uci.set('wireless', section_id, 'encryption', 'none');
                }
            }).then(L.bind(function() {
                return this.renderMoreOptionsModal(section_id);
            }, this));
        };

        s.handleJoin = function(radioDev, bss, ev) {
            poll.remove(this.pollFn);

            var m2 = new form.Map('wireless'),
                s2 = m2.section(form.NamedSection, '_new_'),
                enc = L.isObject(bss.encryption) ? bss.encryption : null,
                is_wep = (enc && Array.isArray(enc.wep)),
                is_psk = (enc && Array.isArray(enc.wpa) && L.toArray(enc.authentication).filter(function(a) { return a == 'psk' || a == 'sae' })),
                replace, passphrase, name, bssid, zone;

            s2.render = function() {
                return Promise.all([
                    {},
                    this.renderUCISection('_new_')
                ]).then(this.renderContents.bind(this));
            };

            if (bss.ssid == null) {
                name = s2.option(form.Value, 'ssid', _('Network SSID'), _('The correct SSID must be manually specified when joining a hidden wireless network'));
                name.rmempty = false;
            };

            replace = s2.option(form.Flag, 'replace', _('Replace wireless configuration'));
            replace.default = true;
            replace.readonly = true

            name = s2.option(form.Value, 'name', _('Name of the new network'));
            name.datatype = 'uciname';
            name.default = 'wwan';
            name.readonly = true

            if (is_wep || is_psk) {
                passphrase = s2.option(form.Value, 'password', is_wep ? _('WEP passphrase') : _('WPA passphrase'), _('Specify the secret encryption key here.'));
                passphrase.datatype = is_wep ? 'wepkey' : 'wpakey';
                passphrase.password = true;
                passphrase.rmempty = false;
            }

            if (bss.ssid != null) {
                bssid = s2.option(form.Flag, 'bssid', _('Lock to BSSID'), _('Instead of joining any network with a matching SSID, only connect to the BSSID <code>%h</code>.').format(bss.bssid));
                bssid.default = '0';
            }

            return m2.render().then(L.bind(function(nodes) {
                ui.showModal(_('Joining Network: %q').replace(/%q/, '"%h"'.format(bss.ssid)), [
                    nodes,
                    E('div', { 'class': 'right' }, [
                        E('button', {
                            'class': 'btn',
                            'click': ui.hideModal
                        }, _('Cancel')), ' ',
                        E('button', {
                            'class': 'cbi-button cbi-button-positive important',
                            'click': ui.createHandlerFn(this, 'handleJoinConfirm', radioDev, bss, m2)
                        }, _('Submit'))
                    ])
                ], 'cbi-modal').querySelector('[id="%s"] input[class][type]'.format((passphrase || name).cbid('_new_'))).focus();
            }, this));
        };

        s.handleAdd = function(radioDev, ev) {
            var section_id = next_free_sid(uci.sections('wireless', 'wifi-iface').length);

            uci.unset('wireless', radioDev.getName(), 'disabled');

            uci.add('wireless', 'wifi-iface', section_id);
            uci.set('wireless', section_id, 'device', radioDev.getName());
            uci.set('wireless', section_id, 'mode', 'ap');
            uci.set('wireless', section_id, 'ssid', 'OpenWrt');
            uci.set('wireless', section_id, 'encryption', 'none');

            this.addedSection = section_id;
            return this.renderMoreOptionsModal(section_id);
        };

        o = s.option(form.DummyValue, '_badge');
        o.modalonly = false;
        o.textvalue = function(section_id) {
            var inst = this.section.lookupRadioOrNetwork(section_id),
                node = E('div', { 'class': 'center' });

            if (inst.getWifiNetworks)
                node.appendChild(render_radio_badge(inst));
            else
                node.appendChild(render_network_badge(inst));

            return node;
        };

        o = s.option(form.DummyValue, '_stat');
        o.modalonly = false;
        o.textvalue = function(section_id) {
            var inst = this.section.lookupRadioOrNetwork(section_id);

            if (inst.getWifiNetworks)
                return render_radio_status(inst, this.section.wifis.filter(function(e) {
                    return (e.getWifiDeviceName() == inst.getName());
                }));
            else
                return render_network_status(inst);
        };

        return m.render().then(L.bind(function(m, nodes) {
            poll.add(L.bind(function() {
                var section_ids = m.children[0].cfgsections(),
                    tasks = [network.getHostHints(), network.getWifiDevices()];

                for (var i = 0; i < section_ids.length; i++) {
                    var row = nodes.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(section_ids[i])),
                        dsc = row.querySelector('[data-name="_stat"] > div'),
                        btns = row.querySelectorAll('.cbi-section-actions button');

                    if (dsc.getAttribute('restart') == '') {
                        dsc.setAttribute('restart', '1');
                        tasks.push(fs.exec('/sbin/wifi', ['up', section_ids[i]]).catch(function(e) {
                            ui.addNotification(null, E('p', e.message));
                        }));
                    } else if (dsc.getAttribute('restart') == '1') {
                        dsc.removeAttribute('restart');
                        btns[0].classList.remove('spinning');
                        btns[0].disabled = false;
                    }
                }

                return Promise.all(tasks)
                    .then(L.bind(function(hosts_radios) {
                        var tasks = [];

                        for (var i = 0; i < hosts_radios[1].length; i++)
                            tasks.push(hosts_radios[1][i].getWifiNetworks());

                        return Promise.all(tasks).then(function(data) {
                            hosts_radios[2] = [];

                            for (var i = 0; i < data.length; i++)
                                hosts_radios[2].push.apply(hosts_radios[2], data[i]);

                            return hosts_radios;
                        });
                    }, network))
                    .then(L.bind(function(hosts_radios_wifis) {
                        var tasks = [];

                        for (var i = 0; i < hosts_radios_wifis[2].length; i++)
                            tasks.push(hosts_radios_wifis[2][i].getAssocList());

                        return Promise.all(tasks).then(function(data) {
                            hosts_radios_wifis[3] = [];

                            for (var i = 0; i < data.length; i++) {
                                var wifiNetwork = hosts_radios_wifis[2][i],
                                    radioDev = hosts_radios_wifis[1].filter(function(d) { return d.getName() == wifiNetwork.getWifiDeviceName() })[0];

                                for (var j = 0; j < data[i].length; j++)
                                    hosts_radios_wifis[3].push(Object.assign({ radio: radioDev, network: wifiNetwork }, data[i][j]));
                            }

                            return hosts_radios_wifis;
                        });
                    }, network))
                    .then(L.bind(this.poll_status, this, nodes));
            }, this), 5);

            var table = E('table', { 'class': 'table assoclist', 'id': 'wifi_assoclist_table' }, [
                E('tr', { 'class': 'tr table-titles' }, [
                    E('th', { 'class': 'th nowrap' }, _('Network')),
                    E('th', { 'class': 'th hide-xs' }, _('MAC address')),
                    E('th', { 'class': 'th' }, _('Host')),
                    E('th', { 'class': 'th' }, _('Signal / Noise')),
                    E('th', { 'class': 'th' }, _('RX Rate / TX Rate'))
                ])
            ]);

            cbi_update_table(table, [], E('em', { 'class': 'spinning' }, _('Collecting data...')))

            return E([nodes, E('h3', _('Associated Stations')), table]);
        }, this, m));
    },
    handleSaveApply: function(ev, mode) {
        return this.handleSave(ev).then(function() {
            fs.exec("/sbin/wifi_config_state_check");
            classes.ui.changes.apply(false);
        });
    },
});