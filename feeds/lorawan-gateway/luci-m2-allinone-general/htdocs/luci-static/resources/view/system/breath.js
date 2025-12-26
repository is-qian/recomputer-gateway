'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require rpc';
'require form';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('rgb_config')
		]);
	},

	render: function(results) {
		var m, s, o, k;

		m = new form.Map('rgb_config',
			_('Breathing Light'),
			_('Here you can configure the breathing light action.'));

		s = m.section(form.TypedSection, 'interface', _('Breathing Light Properties'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('display', _('Display Settings'));
		s.tab('sleep', _('Sleep Settings'));

		o = s.taboption('display', form.ListValue, 'mode', _('Mode'));
		o.value('all',_('Turn On'));
		o.value('warn', _('Warning Only'));
		o.value('disable',_('Turn Off'));

		o = s.taboption('sleep', form.Flag, 'enable', _('Enable'));
		o.default = o.disable;

		k = s.taboption('sleep', form.ListValue, 'st_hh', _('start'), _('In hour'));
		k.depends('enable', '1');
		for (var i = 0; i < 24; i ++)
			k.value(i, i);

		k = s.taboption('sleep', form.ListValue, 'st_mm', _(' '), _('In minute'));
		k.depends('enable', '1');
		for (var i = 0; i < 60; i ++)
			k.value(i, i);

		k = s.taboption('sleep', form.ListValue, 'sp_hh', _('stop'), _('In hour'));
		k.depends('enable', '1');
		for (var i = 0; i < 24; i ++)
			k.value(i, i);

		k = s.taboption('sleep', form.ListValue, 'sp_mm', _(' '), _('In minute'));
		k.depends('enable', '1');
		for (var i = 0; i < 60; i ++)
			k.value(i, i);

		return m.render();
	},

	handleSaveApply: function(ev) {
		var enab, sthh, stmm, sphh, spmm, err = 0;

		enab = parseInt(dom.callClassMethod(document.getElementById('cbid.rgb_config.RGB.enable'), 'getValue'));
		sthh = parseInt(dom.callClassMethod(document.getElementById('cbid.rgb_config.RGB.st_hh'), 'getValue'));
		stmm = parseInt(dom.callClassMethod(document.getElementById('cbid.rgb_config.RGB.st_mm'), 'getValue'));
		sphh = parseInt(dom.callClassMethod(document.getElementById('cbid.rgb_config.RGB.sp_hh'), 'getValue'));
		spmm = parseInt(dom.callClassMethod(document.getElementById('cbid.rgb_config.RGB.sp_mm'), 'getValue'));
		
		if(enab == 1) {
			if(sthh == sphh && stmm == spmm) {
				err = 1;
			}
			if(err == 1) {
				ui.addNotification(null, E('p', _('Start time must different from stop time!')), 'danger');
				return;
			}
		}

		var tasks = [];
		document.getElementById('maincontent')
			.querySelectorAll('.cbi-map').forEach(function(map) {
				tasks.push(DOM.callClassMethod(map, 'save'));
		});
		Promise.all(tasks);
		ui.changes.apply(true);

		setTimeout(function () {
			fs.exec('/etc/init.d/rgb-serve',['restart']);
		}, 3000);
	},
	handleSave: null,
	handleReset: null
});