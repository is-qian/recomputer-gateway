'use strict';
'require view';
'require dom';
'require form';
'require rpc';
'require fs';
'require ui';

document.querySelector('head').appendChild(E('link', {
    'rel': 'stylesheet',
    'type': 'text/css',
    'href': L.resource('view/system/progress.css')
}));

var isReadonlyView = !L.hasViewPermission();

var callSystemValidateFirmwareImage = rpc.declare({
	object: 'system',
	method: 'validate_firmware_image',
	params: [ 'path' ],
	expect: { '': { valid: false, forcable: true } }
});

var callOsupgradeInfo = rpc.declare({
	object: 'sensecap',
	method: 'osupgrade',
	reject: true
});
var callUpgradeStart = rpc.declare({
	object: 'sensecap',
	method: 'osupgrade',
	params: ['action'],
});

var callUpgradeIndicate = rpc.declare({
	object: 'sensecap',
	method: 'upgrade_sys',
	params: ['state'],
});

function findStorageSize(procmtd, procpart) {
	var kernsize = 0, rootsize = 0, wholesize = 0;

	procmtd.split(/\n/).forEach(function(ln) {
		var match = ln.match(/^mtd\d+: ([0-9a-f]+) [0-9a-f]+ "(.+)"$/),
		    size = match ? parseInt(match[1], 16) : 0;

		switch (match ? match[2] : '') {
		case 'linux':
		case 'firmware':
			if (size > wholesize)
				wholesize = size;
			break;

		case 'kernel':
		case 'kernel0':
			kernsize = size;
			break;

		case 'rootfs':
		case 'rootfs0':
		case 'ubi':
		case 'ubi0':
			rootsize = size;
			break;
		}
	});

	if (wholesize > 0)
		return wholesize;
	else if (kernsize > 0 && rootsize > kernsize)
		return kernsize + rootsize;

	procpart.split(/\n/).forEach(function(ln) {
		var match = ln.match(/^\s*\d+\s+\d+\s+(\d+)\s+(\S+)$/);
		if (match) {
			var size = parseInt(match[1], 10);

			if (!match[2].match(/\d/) && size > 2048 && wholesize == 0)
				wholesize = size * 1024;
		}
	});

	return wholesize;
}


var mapdata = { actions: {}, config: {} };

return view.extend({
	load: function() {
		var tasks = [
			L.resolveDefault(fs.stat('/lib/upgrade/platform.sh'), {}),
			fs.trimmed('/proc/sys/kernel/hostname'),
			fs.trimmed('/proc/mtd'),
			fs.trimmed('/proc/partitions'),
			fs.trimmed('/proc/mounts'),
			L.resolveDefault(callOsupgradeInfo(), {state: "newest"})
		];

		return Promise.all(tasks);
	},

	handleBackup: function(ev) {
		var form = E('form', {
			method: 'post',
			action: L.env.cgi_base + '/cgi-backup',
			enctype: 'application/x-www-form-urlencoded'
		}, E('input', { type: 'hidden', name: 'sessionid', value: rpc.getSessionID() }));

		ev.currentTarget.parentNode.appendChild(form);

		form.submit();
		form.parentNode.removeChild(form);
	},

	handleFirstboot: function(ev) {
		if (!confirm(_('Do you really want to erase all settings?')))
			return;

		ui.showModal(_('Erasing...'), [
			E('p', { 'class': 'spinning' }, _('The system is erasing the configuration partition now and will reboot itself when finished.'))
		]);

		/* Currently the sysupgrade rpc call will not return, hence no promise handling */
		fs.exec('/sbin/firstboot', [ '-y' ]).then(
			st => {
				fs.exec('/sbin/reboot');
				ui.awaitReconnect(window.location.host);
			}
		)
	},

	handleRestore: function(ev) {
		return ui.uploadFile('/tmp/backup.tar.gz', ev.target)
			.then(L.bind(function(btn, res) {
				btn.firstChild.data = _('Checking archive…');
				return fs.exec('/bin/tar', [ '-tzf', '/tmp/backup.tar.gz' ]);
			}, this, ev.target))
			.then(L.bind(function(btn, res) {
				if (res.code != 0) {
					ui.addNotification(null, E('p', _('The uploaded backup archive is not readable')));
					return fs.remove('/tmp/backup.tar.gz');
				}

				ui.showModal(_('Apply backup?'), [
					E('p', _('The uploaded backup archive appears to be valid and contains the files listed below. Press "Continue" to restore the backup and reboot, or "Cancel" to abort the operation.')),
					E('pre', {}, [ res.stdout ]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.createHandlerFn(this, function(ev) {
								return fs.remove('/tmp/backup.tar.gz').finally(ui.hideModal);
							})
						}, [ _('Cancel') ]), ' ',
						E('button', {
							'class': 'btn cbi-button-action important',
							'click': ui.createHandlerFn(this, 'handleRestoreConfirm', btn)
						}, [ _('Continue') ])
					])
				]);
			}, this, ev.target))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) })
			.finally(L.bind(function(btn, input) {
				btn.firstChild.data = _('Upload archive...');
			}, this, ev.target));
	},

	handleRestoreConfirm: function(btn, ev) {
		return fs.exec('/sbin/pre_restore', ['/tmp/backup.tar.gz' ])
			.then(L.bind(function(btn, res) {
				if (res.code != 0) {
					ui.addNotification(null, [
						E('p', _('The restore command failed with code %d').format(res.code)),
						res.stderr ? E('pre', {}, [ res.stderr ]) : ''
					]);
					L.raise('Error', 'Unpack failed');
				}

				btn.firstChild.data = _('Rebooting…');
				return fs.exec('/sbin/reboot');
			}, this, ev.target))
			.then(L.bind(function(res) {
				if (res.code != 0) {
					ui.addNotification(null, E('p', _('The reboot command failed with code %d').format(res.code)));
					L.raise('Error', 'Reboot failed');
				}

				ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning' }, _('The system is rebooting now. If the restored configuration changed the current LAN IP address, you might need to reconnect manually.'))
				]);

				ui.awaitReconnect(window.location.host);
			}, this))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) })
			.finally(function() { btn.firstChild.data = _('Upload archive...') });
	},

	handleBlock: function(hostname, ev) {
		var mtdblock = dom.parent(ev.target, '.cbi-section').querySelector('[data-name="mtdselect"] select').value;
		var form = E('form', {
			'method': 'post',
			'action': L.env.cgi_base + '/cgi-download',
			'enctype': 'application/x-www-form-urlencoded'
		}, [
			E('input', { 'type': 'hidden', 'name': 'sessionid', 'value': rpc.getSessionID() }),
			E('input', { 'type': 'hidden', 'name': 'path',      'value': '/dev/mtdblock%d'.format(mtdblock) }),
			E('input', { 'type': 'hidden', 'name': 'filename',  'value': '%s.mtd%d.bin'.format(hostname, mtdblock) })
		]);

		ev.currentTarget.parentNode.appendChild(form);

		form.submit();
		form.parentNode.removeChild(form);
	},

	handleSysupgrade: function(storage_size, has_rootfs_data, ev) {
		return ui.uploadFile('/tmp/firmware.bin', ev.target.firstChild)
			.then(L.bind(function(btn, reply) {
				btn.firstChild.data = _('Checking image…');

				ui.showModal(_('Checking image…'), [
					E('span', { 'class': 'spinning' }, _('Verifying the uploaded image file.'))
				]);

				return callSystemValidateFirmwareImage('/tmp/firmware.bin')
					.then(function(res) { return [ reply, res ]; });
			}, this, ev.target))
			.then(L.bind(function(btn, reply) {
				return fs.exec('/sbin/sysupgrade', [ '--test', '/tmp/firmware.bin' ])
					.then(function(res) { reply.push(res); return reply; });
			}, this, ev.target))
			.then(L.bind(function(btn, res) {
				/* sysupgrade opts table  [0]:checkbox element [1]:check condition [2]:args to pass */
				var is_valid = res[1].valid,
				    is_forceable = res[1].forceable,
				    allow_backup = res[1].allow_backup,
				    is_too_big = (storage_size > 0 && res[0].size > storage_size),
				    body = [];

				body.push(E('p', _("The flash image was uploaded. Below is the checksum and file size listed, compare them with the original file to ensure data integrity. <br /> Click 'Continue' below to start the flash procedure.")));
				body.push(E('ul', {}, [
					res[0].size ? E('li', {}, '%s: %1024.2mB'.format(_('Size'), res[0].size)) : '',
					res[0].checksum ? E('li', {}, '%s: %s'.format(_('MD5'), res[0].checksum)) : '',
					res[0].sha256sum ? E('li', {}, '%s: %s'.format(_('SHA256'), res[0].sha256sum)) : ''
				]));

				if (!is_valid || is_too_big)
					body.push(E('hr'));

				if (is_too_big)
					body.push(E('p', { 'class': 'alert-message' }, [
						_('It appears that you are trying to flash an image that does not fit into the flash memory, please verify the image file!')
					]));

				if (!is_valid)
					body.push(E('p', { 'class': 'alert-message' }, [
						_('The uploaded image file does not contain a supported format. Make sure that you choose the SenseCAP M2 image.')
					]));

				var cntbtn = E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleSysupgradeConfirm', btn),
				}, [ _('Continue') ]);

				if (res[2].code != 0) {
					body.push(E('p', { 'class': 'alert-message danger' }, E('label', {}, [
						_('Image check failed:'),
						_('Please upload the image again !')
					])));
				};

				if ((!is_valid || is_too_big || res[2].code != 0) && is_forceable) {
					cntbtn.disabled = true;
				};
				body.push(E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.createHandlerFn(this, function(ev) {
							return fs.remove('/tmp/firmware.bin').finally(ui.hideModal);
						})
					}, [ _('Cancel') ]), ' ', cntbtn
				]));

				ui.showModal(_('Flash image?'), body);
			}, this, ev.target))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) })
			.finally(L.bind(function(btn) {
				btn.firstChild.data = _('Flash image...');
			}, this, ev.target));
	},

	handleSysupgradeConfirm: function(btn, ev) {
		btn.firstChild.data = _('Flashing…');

		ui.showModal(_('Flashing…'), [
			E('p', { 'class': 'spinning' }, _('The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect.'))
		]);

		var args = [];
		args.push('-n');
		args.push('/tmp/firmware.bin');
		
		callUpgradeIndicate("1").then( 
			res => {
				console.log(res);
				// wait rgb-serve set 
				setTimeout(function () {
					fs.exec('/sbin/sysupgrade', args);
					ui.awaitReconnect(window.location.host);
				}, 4000);
			}
		);
	},

	handleOsupgrade: function( cur_version, tar_version, ev) {

		var body = [];
		const domArr = [
			{title :'Ready', step_id : 'ReadyStep',progress_id: 'ReadyProgress' },
			{title :'Download', step_id : 'DownloadStep',progress_id: 'DownloadProgress' },
			{title :'Upgrade',  step_id : 'UpgradeStep',progress_id: 'UpgradeProgress'},
			{title :'Done',     step_id : 'DoneStep',progress_id: 'DoneProgress'}
		]

		body.push(E('div', {'class': 'steps'}, 
			domArr.map(function(item, index){
				return E('div', {'class': 'step'},[
					E('div', {'class': 'step-icon'}, [
						E('div', {'class': 's-point', id : item.step_id}),
						E('div', {'class': 's-progress'},
							E('span', {'style':'width:0%', id: item.progress_id})
						)
					]),
					E('hr'),
					E('div', {'class': 'step-title'},item.title)
				])
			})
		))
		
		body.push(E('br'));
		body.push(E('p', { 'class': 'alert-message', 'id': 'hint_id'}, [
			_('Ready upgrade...')
		]));
		var cntbtn = E('button', {
			'class': 'btn cbi-button-action important',
			'click': ui.createHandlerFn(this, function(ev) {
				return callUpgradeStart("1").finally(ui.hideModal);
			})
		}, [ _('Cancel') ]);

		body.push(E('div', { 'class': 'right' }, [cntbtn]));

		cntbtn.disabled = true;

		ui.showModal(_('OS upgrade'), body);

		var download_progress = 0;
		var upgrade_progress  = 0;

		document.getElementById('ReadyStep').classList.add('active');
		document.getElementById('ReadyProgress').style='width:50%';

		callUpgradeStart("1").then(
			function(res) {
				fs.exec('/etc/init.d/osupgrade', ['restart']);
			}
		)

		L.Poll.add(function() {
			callOsupgradeInfo().then(L.bind(function(data) {
				var st = data['step'];

				if ( st == 'downloading') {
					document.getElementById('ReadyProgress').style='width:100%';

					document.getElementById('DownloadStep').classList.add('active');
					download_progress = download_progress + 9; //11s
					upgrade_progress = 0; 
					if(  download_progress >= 99) {
						download_progress = 99;
					}
					document.getElementById('DownloadProgress').style='width:'+download_progress +'%';
					document.getElementById('UpgradeProgress').style='width:'+upgrade_progress +'%';

					document.getElementById('hint_id').innerHTML="Downloading, please make sure the network connection is normal!"
				} 
				if ( st == 'upgrading') {
					document.getElementById('UpgradeStep').classList.add('active');
					upgrade_progress = upgrade_progress + 30;
					download_progress = 100;

					if(  upgrade_progress >= 99) {
						upgrade_progress = 99;
					}
					document.getElementById('UpgradeProgress').style='width:'+upgrade_progress +'%';
					document.getElementById('DownloadProgress').style='width:'+download_progress +'%';

					document.getElementById('hint_id').innerHTML="The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect."
				}

				if ( st == "error" ) {
					cntbtn.disabled = false;
					document.getElementById('hint_id').setAttribute('class','alert-message danger')
					document.getElementById('hint_id').innerHTML= data['error_msg'] + "<br />Please try again!"; 
				}

				console.log(st, download_progress, upgrade_progress)
			}));

		},1)
	},
	
	render: function(rpc_replies) {
		var has_sysupgrade = (rpc_replies[0].type == 'file'),
		    hostname = rpc_replies[1],
		    procmtd = rpc_replies[2],
		    procpart = rpc_replies[3],
		    procmounts = rpc_replies[4],
			osupgradeInfo = rpc_replies[5],
		    has_rootfs_data = (procmtd.match(/"rootfs_data"/) != null) || (procmounts.match("overlayfs:\/overlay \/ ") != null),
		    storage_size = findStorageSize(procmtd, procpart),
		    m, s, o, ss;

		m = new form.JSONMap(mapdata, _('Flash operations'));
		m.tabbed = true;
		m.readonly = isReadonlyView;

		s = m.section(form.NamedSection, 'actions', _('Actions'));


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Backup'), _('Click "Generate archive" to download a tar archive of the current configuration files.'));
		ss = o.subsection;

		o = ss.option(form.Button, 'dl_backup', _('Download backup'));
		o.inputstyle = 'action important';
		o.inputtitle = _('Generate archive');
		o.onclick = this.handleBackup;


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Restore'), _('To restore configuration files, you can upload a previously generated backup archive here. To reset the firmware to its initial state, click "Perform reset" (only possible with squashfs images).'));
		ss = o.subsection;

		if (has_rootfs_data) {
			o = ss.option(form.Button, 'reset', _('Reset to defaults'));
			o.inputstyle = 'negative important';
			o.inputtitle = _('Perform reset');
			o.onclick = this.handleFirstboot;
		}

		o = ss.option(form.Button, 'restore', _('Restore backup'), _('Custom files (certificates, scripts) may remain on the system. To prevent this, perform a factory-reset first.'));
		o.inputstyle = 'action important';
		o.inputtitle = _('Upload archive...');
		o.onclick = L.bind(this.handleRestore, this);


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Online update'), _("The system will check whether there is a new OS version every 5min cycle."));
		ss = o.subsection;
		
		o = ss.option(form.DummyValue, 'cur_version', _("Current OS Version"));
		o.load = function(section_id) {
			return osupgradeInfo.cur_version;
		};

		o = ss.option(form.DummyValue, 'tar_version', _("Target OS version"));

		if ( osupgradeInfo.state == "pengding" ){

			o.load = function(section_id) {
				return osupgradeInfo.tar_version;
			};

			o = ss.option(form.TextValue, 'changelog', _("Change log"));
			o.readonly = true;
			o.rows = 5;
			o.load = function(section_id) {
				return osupgradeInfo.change_log;
			};

			o = ss.option(form.Button, 'osupgrade', _("Update"),_("Internet connection required"));
			o.inputstyle = 'action important';
			o.inputtitle = _('Update...');
			o.onclick = L.bind(this.handleOsupgrade, this, osupgradeInfo.cur_version, osupgradeInfo.tar_version);

		} else {
			o.load = function(section_id) {
				return "The current OS version is already up to date";
			};
		}

		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Local upgrade'),
			has_sysupgrade
				? _('Upload a SenseCAP M2 image here to replace the running firmware.')
				: _('Sorry, there is no sysupgrade support present; a new firmware image must be flashed manually. Please refer to the wiki for device specific install instructions.'));

		ss = o.subsection;

		if (has_sysupgrade) {
			o = ss.option(form.Button, 'sysupgrade', _('Image'));
			o.inputstyle = 'action important';
			o.inputtitle = _('Flash image...');
			o.onclick = L.bind(this.handleSysupgrade, this, storage_size, has_rootfs_data);
		}

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
