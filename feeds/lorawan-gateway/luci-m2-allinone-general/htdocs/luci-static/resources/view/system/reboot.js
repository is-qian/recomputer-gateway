'use strict';
'require view';
'require rpc';
'require fs';
'require ui';
'require uci';
'require form';

var RebootButton;

var callReboot = rpc.declare({
	object: 'system',
	method: 'reboot',
	expect: { result: 0 }
});

RebootButton = form.DummyValue.extend({
	renderWidget: function(section_id, option_id) {
		return E([],[
			E('p', {}, _('Reboot immediately')),
			E('br'),
			E('button', {
				'class': 'cbi-button cbi-button-action important',
				'click': ui.createHandlerFn(this, 'handleReboot')
			}, _('Perform reboot'))
		]);
	},

	handleReboot: function(ev) {
		return callReboot().then(function(res) {
			if (res != 0) {
				L.ui.addNotification(null, E('p', _('The reboot command failed with code %d').format(res)));
				L.raise('Error', 'Reboot failed');
			}

			L.ui.showModal(_('Rebooting…'), [
				E('p', { 'class': 'spinning' }, _('Waiting for device...'))
			]);

			window.setTimeout(function() {
				L.ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning alert-message warning' },
						_('Device unreachable! Still waiting for device...'))
				]);
			}, 150000);

			L.ui.awaitReconnect();
		})
		.catch(function(e) { L.ui.addNotification(null, E('p', e.message)) });
	}
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('reboot_config')
		]);
	},

	render: function(results) {
		var m, s, o, k, b;

		m = new form.Map('reboot_config',
			_('Reboot'),
			_('Reboots the operating system of your device'));
		
		s = m.section(form.TypedSection, 'interface', _('Reboot Action'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Reboot'));
		s.tab('timer', _('Reboot Timer'));

		o = s.taboption('general', RebootButton, '_reboot', _(''));

		o = s.taboption('timer', form.Flag, 'enable', _('Enable'));
		o.default = o.disable;

		k = s.taboption('timer', form.ListValue, 'hh', _('Hour'), _('In hour'));
		k.depends('enable', '1');
		for (var i = 0; i < 24; i ++)
			k.value(i, i);

		k = s.taboption('timer', form.ListValue, 'mm', _('Minute'), _('In minute'));
		k.depends('enable', '1');
		for (var i = 0; i < 60; i ++)
			k.value(i, i);

		k = s.taboption('timer', form.ListValue, 'dd', _('Interval'), _('In day'));
		k.depends('enable', '1');
		for (var i = 1; i < 32; i ++)
			k.value(i, i);

		b =  s.taboption('timer', form.Button, '_button', _(' '));
		b.inputstyle = 'action important';
		b.inputtitle = _('Generate archive');
		b.onclick = this.handleRebootTime;

		return m.render();
	},

	handleRebootTime: function(ev) {
		var tasks = [];
		document.getElementById('maincontent')
			.querySelectorAll('.cbi-map').forEach(function(map) {
				tasks.push(DOM.callClassMethod(map, 'save'));
			});
		Promise.all(tasks);

		ui.changes.apply(true);

		fs.read('/etc/crontabs/root').then(res=>{
			var oldtext = res.split('\n');
			for(var i = 0; i < oldtext.length; ) {
				var flag = oldtext[i].search("reboot");
				if(flag != (-1)) {
					oldtext.splice(i,1);
					i = 0;
				}
				else {
					i ++;
				}
			}
			var newtext = oldtext.join('\n');

			var enable = uci.get('reboot_config', 'REBOOT', 'enable');
			if(enable == 1)
			{
				var hh, mm, dd;

				hh = uci.get('reboot_config', 'REBOOT', 'hh');
				mm = uci.get('reboot_config', 'REBOOT', 'mm');
				dd = uci.get('reboot_config', 'REBOOT', 'dd');

				fs.write('/etc/crontabs/root', newtext + mm + ' ' + hh + ' */' + dd + ' * * ' + '/sbin/reboot' + '\n');
				fs.exec('/etc/init.d/cron', [ 'enable' ]);
				fs.exec('/etc/init.d/cron', [ 'restart' ]);
			}
			else
			{
				fs.write('/etc/crontabs/root', newtext);
			}
		})
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
