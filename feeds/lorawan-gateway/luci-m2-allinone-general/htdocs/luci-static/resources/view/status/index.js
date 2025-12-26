'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require network';
'require request';
'require rpc';

var callNetState = rpc.declare({
	object: 'sensecap',
	method: 'net_state',
	reject: true
});

var callValidatorState = rpc.declare({
	object: 'sensecap',
	method: 'lora_network_connect',
	reject: true
});

var callLoraHistory = rpc.declare({
	object: 'sensecap',
	method: 'lora_history',
	reject: true
});


var elSvg2 = null;
var H = 300;  //lora packets chart height
var vCnt = 10;  //num of grids on y-axis



function invokeIncludesLoad(includes) {
	var tasks = [], has_load = false;

	for (var i = 0; i < includes.length; i++) {
		if (typeof(includes[i].load) == 'function') {
			tasks.push(includes[i].load().catch(L.bind(function() {
				this.failed = true;
			}, includes[i])));

			has_load = true;
		}
		else {
			tasks.push(null);
		}
	}

	return has_load ? Promise.all(tasks) : Promise.resolve(null);
}

function displayInternetState() {

	return L.resolveDefault(callNetState(), {state: 0}).then(function(result) {
		const { state } = result;
		let elCheckInternet = document.querySelector("#check_internet");
		let elErrorInternet = document.querySelector("#error_internet");
		if (state == 1) {
			elCheckInternet.setAttribute('style', 'visibility: visible');
			elErrorInternet.setAttribute('style', 'visibility: hidden');
		} else {
			elCheckInternet.setAttribute('style', 'visibility: hidden');
			elErrorInternet.setAttribute('style', 'visibility: visible');
		}

		//TODO: do real detection when we know how
		return L.resolveDefault(callValidatorState(), {lora_pkt_fwd: 0, station: 0});
	}).then(function(result) {
		console.log(result);
		var state = result.lora_pkt_fwd | result.station;
		let elCheckValidator = document.querySelector("#check_validator");
		let elErrorValidator = document.querySelector("#error_validator");
		if (state == 1) {
			elCheckValidator.setAttribute('style', 'visibility: visible');
			elErrorValidator.setAttribute('style', 'visibility: hidden');
		} else {
			elCheckValidator.setAttribute('style', 'visibility: hidden');
			elErrorValidator.setAttribute('style', 'visibility: visible');
		}
	});
}

function updateLoRaPacketsChart(data) {
	var G = elSvg2.firstElementChild;
	var view = document.querySelector('#view');
	var width  = view.offsetWidth;

	if (!(Array.isArray(data) && data.length == 24)) return;

	// update y-axis text
	var maxCnt = 0;
	for (const [rx,tx] of data) {
		const cnt = parseInt(rx) + parseInt(tx);
		if (cnt > maxCnt) maxCnt = cnt;
	}

	maxCnt = maxCnt % 10 == 0 ? maxCnt : (maxCnt - (maxCnt % 10) + 10);
	if (maxCnt < 10) maxCnt = 10; 

	var nStep = maxCnt / vCnt;

	for (let i = 0; i < vCnt; i++) {
		let elem = G.getElementById(`ytext${i}`);

		var text = `${nStep * (i + 1)}`;
		dom.content(elem, text);
	}

	// update chart
	let center = 98;
	let yBase = H - 20;
	let yPer = (H - 20 - 20) / maxCnt;
	for (let i = 0; i < 24; i++) {
		let [rx, tx] = data[i];
		rx = parseInt(rx);
		tx = parseInt(tx);
		if (rx < 0) rx = 0;
		if (tx < 0) tx = 0;
		if (isNaN(rx) || isNaN(tx)) {
			console.log(`invalid number received:`);
			console.log(data);
			if (isNaN(rx)) rx = 0;
			if (isNaN(tx)) tx = 0;
		}
		//rx
		const points = [
			(width * (center - 1) / 100) + ',' + (yBase),
			(width * (center - 1) / 100) + ',' + (yBase - yPer * rx),
			(width * (center + 1) / 100) + ',' + (yBase - yPer * rx),
			(width * (center + 1) / 100) + ',' + (yBase),
		];
		let rxTop = (yBase - yPer * rx);
		let poly = G.getElementById(`rx${i}`);
		let text = G.getElementById(`rxtext${i}`);
		poly.setAttribute('points', points);
		text.setAttribute('y', rxTop + 9);
		text.setAttribute('x', (width * center / 100) - (`${rx}`.length * 6) / 2);
		if (yPer * rx > 9) {
			dom.content(text, `${rx}`);
		} else {
			dom.content(text, "");
		}
		//tx
		const points2 = [
			(width * (center - 1) / 100) + ',' + (rxTop),
			(width * (center - 1) / 100) + ',' + (rxTop - yPer * tx),
			(width * (center + 1) / 100) + ',' + (rxTop - yPer * tx),
			(width * (center + 1) / 100) + ',' + (rxTop),
		];
		let txTop = (rxTop - yPer * tx);
		let poly2 = G.getElementById(`tx${i}`);
		let text2 = G.getElementById(`txtext${i}`);
		poly2.setAttribute('points', points2);
		text2.setAttribute('y', txTop + 9);
		text2.setAttribute('x', (width * center / 100) - (`${tx}`.length * 6) / 2);
		if (yPer * tx > 9) {
			dom.content(text2, `${tx}`);
		} else {
			dom.content(text2, "");
		}

		//total
		let total = rx + tx;
		let text3 = G.getElementById(`totaltext${i}`);
		if (total > 0) {
			text3.setAttribute('y', txTop - 1);
			text3.setAttribute('x', (width * center / 100) - (`${total}`.length * 6) / 2);
			dom.content(text3, `${total}`);
		} else {
			dom.content(text3, "");
		}

		center -= 4;
	}


}

function updateChart() {
	return displayInternetState().then(function() {
		return L.resolveDefault(callLoraHistory(), {});
	}).then(function(result) {
		// console.log(result);
		if (L.isObject(result) && 'data' in result) {
			return result['data'];
		} else {
			let dummy = [];
			for (let i = 0; i < 24; i++) {
				dummy.push([0,0]);
			}
			return dummy;
		}
	}).then(updateLoRaPacketsChart);
}

function startPolling(includes, containers) {
	var step = function() {
		return network.flushCache().then(function() {
			return invokeIncludesLoad(includes);
		}).then(function(results) {
			for (var i = 0; i < includes.length; i++) {
				var content = null;

				if (includes[i].failed)
					continue;

				if (typeof(includes[i].render) == 'function')
					content = includes[i].render(results ? results[i] : null);
				else if (includes[i].content != null)
					content = includes[i].content;

				if (content != null) {
					containers[i].parentNode.style.display = '';
					containers[i].parentNode.classList.add('fade-in');

					dom.content(containers[i], content);
				}
			}

			var ssi = document.querySelector('div.includes');
			if (ssi) {
				ssi.style.display = '';
				ssi.classList.add('fade-in');
			}
		}).then(updateChart);
	};

	return Promise.resolve(poll.add(step, 30));
}

return view.extend({

	loadSVG: function(src) {
		return request.get(src).then(function(response) {
			if (!response.ok)
				throw new Error(response.statusText);

			return E('div', {
				'style': 'width:100%;'
			}, E(response.text()));
		});
	},

	load: function() {
		var self = this;
		return L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []).then(function(entries) {
			var pre = [self.loadSVG(L.resource('svg/internet_connection.svg')), self.loadSVG(L.resource('svg/lora_packets.svg'))];
			var all = pre.concat(entries.filter(function(e) {
				return (e.type == 'file' && e.name.match(/\.js$/));
			}).map(function(e) {
				return 'view.status.include.' + e.name.replace(/\.js$/, '');
			}).sort().map(function(n) {
				return L.require(n);
			}));
			return Promise.all(all);
		});
	},

	initLoRaPacketsChart: function(svg) {
		var G = svg.firstElementChild;
		var baselineH = H - 20;
		var view = document.querySelector('#view');
		var width  = view.offsetWidth;
		console.log(`view width: ${width}`);

		// createBaseLine
		var elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		elem.setAttribute('x1', '4%');
		elem.setAttribute('y1', baselineH);
		elem.setAttribute('x2', '100%');
		elem.setAttribute('y2', baselineH);
		elem.setAttribute('style', 'stroke:black;stroke-width:1');
		G.appendChild(elem);


		for (let i = 0; i < 25; i++) {
			var x = 4 + i * 4;
			elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			elem.setAttribute('x1', `${x}%`);
			elem.setAttribute('y1', baselineH);
			elem.setAttribute('x2', `${x}%`);
			elem.setAttribute('y2', baselineH + 2);
			elem.setAttribute('style', 'stroke:black;stroke-width:1');
			G.appendChild(elem);

			var hour = -24 + i;
			var text = `${hour}h`;
			elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			elem.setAttribute('y', 295);
			elem.setAttribute('style', 'fill:#eee; font-size:9pt; font-family:sans-serif; text-shadow:1px 1px 1px #000');
			elem.setAttribute('x', `${x-1.5}%`);
			elem.appendChild(document.createTextNode(text));
			G.appendChild(elem);
		}

		//create legend
		var lgX = width - 110;
		var elem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		elem.setAttribute('x', lgX);
		elem.setAttribute('y', 1);
		elem.setAttribute('width', 20); lgX += 22;
		elem.setAttribute('height', 8);
		elem.setAttribute('style', 'fill:green;fill-opacity:0.4;stroke:green;stroke-width:1');
		G.appendChild(elem);

		elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		elem.setAttribute('x', lgX); lgX += 20;
		elem.setAttribute('y', 8);
		elem.setAttribute('style', 'fill:green; font-size:9pt; font-family:sans-serif;');
		elem.appendChild(document.createTextNode('rx'));
		G.appendChild(elem);

		elem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		elem.setAttribute('x', lgX);
		elem.setAttribute('y', 1);
		elem.setAttribute('width', 20); lgX += 22;
		elem.setAttribute('height', 8);
		elem.setAttribute('style', 'fill:blue;fill-opacity:0.4;stroke:blue;stroke-width:1');
		G.appendChild(elem);

		elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		elem.setAttribute('x', lgX); lgX += 20;
		elem.setAttribute('y', 8);
		elem.setAttribute('style', 'fill:blue; font-size:9pt; font-family:sans-serif;');
		elem.appendChild(document.createTextNode('tx'));
		G.appendChild(elem);

		elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		elem.setAttribute('x', lgX);
		elem.setAttribute('y', 8);
		elem.setAttribute('style', 'fill:red; font-size:9pt; font-family:sans-serif;');
		elem.appendChild(document.createTextNode('total'));
		G.appendChild(elem);

		// create y-axis grids
		var vStep = (H - 20 - 20) / vCnt;

		for (let i = 0; i < 10; i++) {
			var y = H - 20 - (i + 1) * vStep;
			let elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			elem.setAttribute('x1', '4%');
			elem.setAttribute('y1', y);
			elem.setAttribute('x2', '100%');
			elem.setAttribute('y2', y);
			elem.setAttribute('style', 'stroke:gray;stroke-width:0.2');
			G.appendChild(elem);

			var text = `${i + 1}`;
			elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			elem.setAttribute('y', y + 3);
			elem.setAttribute('style', 'fill:#eee; font-size:9pt; font-family:sans-serif; text-shadow:1px 1px 1px #000');
			elem.setAttribute('x', 10);
			elem.setAttribute('id', `ytext${i}`);
			elem.appendChild(document.createTextNode(text));
			G.appendChild(elem);
		}

		// draw chart
		let center = 98;
		let yBase = H - 20;
		for (let i = 0; i < 24; i++) {
			const points = [
				(width * (center - 1) / 100) + ',' + (yBase),
				(width * (center - 1) / 100) + ',' + (yBase),
				(width * (center + 1) / 100) + ',' + (yBase),
				(width * (center + 1) / 100) + ',' + (yBase),
			];

			let polyrx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			polyrx.setAttribute('style', 'fill:green;fill-opacity:0.4;stroke:green;stroke-width:0.5');
			polyrx.setAttribute('points', points);
			polyrx.setAttribute('id', `rx${i}`);
			G.appendChild(polyrx);

			let polytx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			polytx.setAttribute('style', 'fill:blue;fill-opacity:0.4;stroke:blue;stroke-width:0.5');
			polytx.setAttribute('points', points);
			polytx.setAttribute('id', `tx${i}`);
			G.appendChild(polytx);

			let textrx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			textrx.setAttribute('style', 'fill:green; font-size:8pt; font-family:sans-serif');
			textrx.setAttribute('id', `rxtext${i}`);
			textrx.appendChild(document.createTextNode(""));
			G.appendChild(textrx);

			let texttx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			texttx.setAttribute('style', 'fill:blue; font-size:8pt; font-family:sans-serif');
			texttx.setAttribute('id', `txtext${i}`);
			texttx.appendChild(document.createTextNode(""));
			G.appendChild(texttx);

			let texttotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			texttotal.setAttribute('style', 'fill:red; font-size:8pt; font-family:sans-serif');
			texttotal.setAttribute('id', `totaltext${i}`);
			texttotal.appendChild(document.createTextNode(""));
			G.appendChild(texttotal);

			center -= 4;
		}

	},

	render: function(data) {
		var svg = data[0];
		var svg2 = data[1];
		var includes = data.slice(2);
		var rv = E([]), containers = [];

		var csvg = svg.cloneNode(true);
		rv.appendChild(E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Internet Connection')),
			E('div', {}, [csvg])
		]));
		

		elSvg2 = svg2.cloneNode(true);
		rv.appendChild(E('div', { 'class': 'cbi-section' }, [
			E('h3', _('LoRa Packets')),
			E('div', {'style': 'background:#fff; margin: 20px 0;'}, [elSvg2])
		]));

		this.initLoRaPacketsChart(elSvg2);
		

		for (var i = 0; i < includes.length; i++) {
			var title = null;

			if (includes[i].title != null)
				title = includes[i].title;
			else
				title = String(includes[i]).replace(/^\[ViewStatusInclude\d+_(.+)Class\]$/,
					function(m, n) { return n.replace(/(^|_)(.)/g,
						function(m, s, c) { return (s ? ' ' : '') + c.toUpperCase() })
					});

			var container = E('div');

			rv.appendChild(E('div', { 'class': 'cbi-section', 'style': 'display:none' }, [
				title != '' ? E('h3', title) : '',
				container
			]));

			containers.push(container);
		}

		return startPolling(includes, containers).then(function() {
			return rv;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
