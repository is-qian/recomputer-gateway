'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require poll';

function ensureSection(type) {
	var section = uci.sections("lorawan-gateway", type)[0];
	return section ? section[".name"] : uci.add("lorawan-gateway", type);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('lorawan-gateway'),
			L.resolveDefault(fs.read('/tmp/lorawan-gateway/log'), '')
		]);
	},

	render: function(data) {
		var logPayload = (data[1] || '').trim();

		var m = new form.Map('lorawan-gateway', _('Log Viewer'), _('View LoRaWAN Gateway logs.'));

		var logSection = m.section(form.NamedSection, 'ui', 'log', _('Log Messages'));
		logSection.anonymous = true;
		logSection.addremove = false;

		var o = logSection.option(form.Flag, 'auto_refresh', _('Auto refresh logs when entering page'));
		o.default = '1';

		o = logSection.option(form.Value, 'buffer_limit', _('Maximum buffer lines'));
		o.datatype = 'uinteger';
		o.placeholder = '2000';

		o = logSection.option(form.DynamicList, 'watch_keywords', _('Keyword highlighting'));
		o.placeholder = 'join-accept';

		var logView = logSection.option(form.TextValue, '_log', _('Recent Logs'));
		logView.rows = 18;
		logView.wrap = 'off';
		logView.monospace = true;
		logView.cfgvalue = function() {
			return logPayload || _('No logs available to display');
		};
		logView.write = function() {};

		// Navigation buttons
		var navSection = m.section(form.NamedSection, 'ui', 'navigation', _('Navigation'));
		navSection.anonymous = true;
		navSection.addremove = false;

		o = navSection.option(form.Button, '_lora', _('Go to LoRa Configuration'));
		o.inputstyle = 'action';
		o.inputtitle = _('LoRa');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/lora');
		};

		o = navSection.option(form.Button, '_rs485', _('Go to RS485 Configuration'));
		o.inputstyle = 'action';
		o.inputtitle = _('RS485');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/rs485');
		};

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	addFooter: function() {
		var auto_refresh = uci.get('lorawan-gateway', 'ui', 'auto_refresh');

		// Set textarea to readonly after DOM is ready
		requestAnimationFrame(function() {
			var textarea = document.querySelector('textarea[id*="_log"]');
			if (textarea) {
				textarea.setAttribute('readonly', 'readonly');
				textarea.style.cursor = 'text';
			}
		});

		if (auto_refresh === '1') {
			poll.add(L.bind(function() {
				return fs.read('/tmp/lorawan-gateway/log').then(L.bind(function(logContent) {
					var textarea = document.querySelector('textarea[id*="_log"]');
					if (textarea) {
						var scrolledToBottom = (textarea.scrollHeight - textarea.scrollTop <= textarea.clientHeight + 50);
						textarea.value = (logContent || '').trim() || _('No logs available to display');
						if (scrolledToBottom) {
							textarea.scrollTop = textarea.scrollHeight;
						}
					}
				}, this)).catch(function(err) {
					console.error('Failed to read log file:', err);
				});
			}, this), 1);
		}
	}
});
