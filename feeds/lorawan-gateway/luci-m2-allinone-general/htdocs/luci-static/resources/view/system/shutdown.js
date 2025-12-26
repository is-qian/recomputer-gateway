'use strict';
'require view';
'require rpc';
'require ui';
'require uci';
'require fs';

return view.extend({
	load: function() {
		return uci.changes();
	},

	render: function(changes) {
		var body = E([
			E('h2', _('Shutdown')),
			E('p', {}, _('Shutdown the operating system of your device'))
		]);

		for (var config in (changes || {})) {
			body.appendChild(E('p', { 'class': 'alert-message warning' },
				_('Warning: There are unsaved changes that will get lost on shutdown!')));
			break;
		}

		body.appendChild(E('hr'));
		body.appendChild(E('button', {
			'class': 'cbi-button cbi-button-action important',
			'click': ui.createHandlerFn(this, 'handleShutdown')
		}, _('Perform shutdown')));

		return body;
	},

	handleShutdown: function(ev) {

		return fs.exec('/sbin/poweroff').then(function(res) {
			L.ui.showModal(_('Shutdown…'), [
				E('p', { 'class': 'spinning' }, _('Waiting for device...'))
			]);

			window.setTimeout(function() {
				L.ui.showModal(_('Shutdown…'), [
					E('p', { 'class': 'spinning alert-message warning' },
						_('Device unreachable! Still waiting for device...'))
				]);
			}, 150000);

			L.ui.awaitReconnect();
		})
		.catch(function(e) { L.ui.addNotification(null, E('p', e.message)) });
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
