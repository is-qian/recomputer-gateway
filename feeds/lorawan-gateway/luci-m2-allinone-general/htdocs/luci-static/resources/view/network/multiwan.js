'use strict';
'require poll';
'require view';
'require rpc';
'require form';
'require fs';
'require uci';
'require dom';
'require ui';

var callMwan3Status = rpc.declare({
    object: 'mwan3',
    method: 'status',
    expect: {},
});


var callMwan3Restart = rpc.declare({
    object: 'mwan3',
    method: 'restart',
    expect: {},
});

document.querySelector('head').appendChild(E('link', {
    'rel': 'stylesheet',
    'type': 'text/css',
    'href': L.resource('view/network/multiwan.css')
}));

function renderMwan3Status(status) {
    if (!status.interfaces)
        return '<strong>%h</strong>'.format(_('No MWAN interfaces found'));

    var statusview = '';
    for (var iface in status.interfaces) {
        var state = '';
        var css = '';
        var time = '';
        var tname = '';
        switch (status.interfaces[iface].status) {
            case 'online':
                state = _('Online');
                css = 'success';
                time = '%t'.format(status.interfaces[iface].online);
                tname = _('Uptime');
                css = 'success';
                break;
            case 'offline':
                state = _('Offline');
                css = 'danger';
                time = '%t'.format(status.interfaces[iface].offline);
                tname = _('Downtime');
                break;
            case 'notracking':
                state = _('No Tracking');
                if ((status.interfaces[iface].uptime) > 0) {
                    css = 'success';
                    time = '%t'.format(status.interfaces[iface].uptime);
                    tname = _('Uptime');
                } else {
                    css = 'warning';
                    time = '';
                    tname = '';
                }
                break;
            default:
                state = _('Disabled');
                css = 'warning';
                time = '';
                tname = '';
                break;
        }

        statusview += '<div class="alert-message %h">'.format(css);
        statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(_('Interface'), iface);
        statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(_('Status'), state);

        if (time)
            statusview += '<div><strong>%h:&#160;</strong>%h</div>'.format(tname, time);

        statusview += '</div>';
    }

    return statusview;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('network')
		]);
	},

    render: function(stats) {

        var m, s, o;

        m = new form.Map('mwan3', _('MultiWAN Interfaces'))

        s = m.section(form.GridSection, 'interface');
        s.addremove = false;
        s.anonymous = false;
        s.nodescriptions = true;
        s.extedit = false;

		/* This name length error check can likely be removed when mwan3 migrates to nftables */
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');
			ui.addValidator(nameEl, 'uciname', true, function(v) {
				let sections = [
					...uci.sections('mwan3', 'interface'),
					...uci.sections('mwan3', 'member'),
					...uci.sections('mwan3', 'policy'),
					...uci.sections('mwan3', 'rule')
				];

				for (let j = 0; j < sections.length; j++) {
					if (sections[j]['.name'] == v) {
						return _('Interfaces may not share the same name as configured members, policies or rules.');
					}
				}
				if (v.length > 15) return _('Name length shall not exceed 15 characters');
				return true;
			}, 'blur', 'keyup');
			return el;
		};

		o = s.option(form.DynamicList, 'track_ip', _('Tracking hostname or IP address'),
			_('This hostname or IP address will be pinged to determine if the link is up or down. Leave blank to assume interface is always online'));
		o.datatype = 'host';
		o.modalonly = true;

		o = s.option(form.Value, 'size', _('Ping size'));
		o.default = '56';
		// o.depends('track_method', 'ping');
        o.value('2');
		o.value('8');
		o.value('24');
		o.value('56');
		o.value('120');
		o.value('248');
		o.value('504');
		o.value('1016');
		o.value('1472');
		o.value('2040');
		o.datatype = 'range(1, 65507)';
		o.modalonly = true;


		o = s.option(form.ListValue, 'interval', _('Ping interval'));
		o.default = '10';
		// o.value('1', _('%d second').format('1'));
		// o.value('3', _('%d seconds').format('3'));
		// o.value('5', _('%d seconds').format('5'));
		o.value('10', _('%d seconds').format('10'));
		o.value('20', _('%d seconds').format('20'));
		o.value('30', _('%d seconds').format('30'));
		o.value('60', _('%d minute').format('1'));
		o.value('300', _('%d minutes').format('5'));
		o.value('600', _('%d minutes').format('10'));
		o.value('900', _('%d minutes').format('15'));
		o.value('1800', _('%d minutes').format('30'));
		o.value('3600', _('%d hour').format('1'));


		o = s.option(form.DummyValue, 'metric', _('Metric'),
			_('This displays the metric assigned to this interface in /etc/config/network'));
		o.rawhtml = true;

		o.cfgvalue = function(s) {
			var metric = uci.get('network', s, 'metric')
			if (metric)
				return metric;
			else
				return _('No interface metric set!');
		}
        
        return m.render().then(function(mapEl) {
            poll.add(function() {
                return callMwan3Status().then(function(result) {
                    var view = document.getElementById('mwan3-service-status');
                    view.innerHTML = renderMwan3Status(result);
                });
            });
            mapEl.appendChild(E('h2', [_('MultiWAN Status')]));
            mapEl.appendChild(E('div', { class: 'cbi-section' }, [E('div', { 'id': 'mwan3-service-status' }, [E('em', { 'class': 'spinning' }, [_('Collecting data ...')])])]));
            return mapEl;
        });

    },
})