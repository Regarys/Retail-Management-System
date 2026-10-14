'use strict';

const API = {
	invoices: '/invoice',
	details: (id) => `/invoice_detail/${encodeURIComponent(id)}`,
};

const REQUEST_TIMEOUT = 8000;
const WIDTH = 32;
const DASH = '-'.repeat(WIDTH);

const invoiceId = (() => {
	const fromQuery = new URLSearchParams(window.location.search).get('id');
	if (fromQuery) return fromQuery.trim();

	const parts = window.location.pathname.split('/').filter(Boolean);
	return (parts[parts.length - 1] || '').trim();
})();

const el = {
	paper: document.getElementById('paper'),
	tip: document.getElementById('tip'),
	printBtn: document.getElementById('printBtn'),
	closeBtn: document.getElementById('closeBtn'),
};

/* ---------- format ---------- */

function fitLeft(text, width) {
	const value = String(text);
	return value.length >= width ? value.slice(0, width) : value.padEnd(width, ' ');
}

function fitRight(text, width) {
	const value = String(text);
	return value.length >= width ? value.slice(0, width) : value.padStart(width, ' ');
}

function plain(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) return '0';
	return String(Math.trunc(number));
}

function pairLines(label, value) {
	const left = `${label} :`;
	const right = String(value);

	if (left.length + 1 + right.length <= WIDTH) {
		const gap = WIDTH - left.length - right.length;
		return [left + ' '.repeat(gap) + right];
	}

	return [fitLeft(left, WIDTH), fitRight(right, WIDTH)];
}

function itemHeader() {
	return fitLeft('BARANG', 20) +  fitRight('HARGA', 6) + fitRight('TOTAL', 6);
}

function itemLines(detail) {
	const name = detail.product_name === null || detail.product_name === undefined ? ''
		: String(detail.product_name);
	const values = `  ${plain(detail.qty)} x ${plain(detail.price)}`;
	const total = plain(detail.total);

	if (values.length + 2 + total.length <= WIDTH) {
		return [fitLeft(name, WIDTH), fitLeft(values, WIDTH - total.length - 2) + '= ' + total];
	}

	return [fitLeft(name, WIDTH), fitLeft(values, WIDTH), fitRight(total, WIDTH)];
}

function formatDate(value) {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	return `${day}/${month}/${date.getFullYear()}`;
}

function formatTime(value) {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/* ---------- receipt ---------- */

function buildLines(invoice, details) {
	const itemSum = details.reduce((acc, detail) => acc + (Number(detail.total) || 0), 0);
	// total_price milik server (hasil SUM detail), dipakai supaya struk konsisten
	// dengan daftar faktur; fallback ke jumlah baris kalau 0/null
	const total = Number(invoice.total_price) || itemSum;
	const paid = Number(invoice.paid) || 0;
	const debt = Math.max(0, total - paid);
	const change = Number(invoice.return_price) || 0;
	const customer = invoice.customer_name === null || invoice.customer_name === undefined ? ''
		: invoice.customer_name;

	const lines = [
		fitLeft('UD JERJON'),
		fitLeft('Toko Jerjon'),
		DASH,
	];

	lines.push(...pairLines('Tanggal', formatDate(invoice.created_at)));
	lines.push(...pairLines('Jam Beli', formatTime(invoice.created_at)));
	lines.push(...pairLines('No Struk', String(invoice.id_invoice).padStart(2, '0')));
	lines.push(DASH);
	lines.push(...pairLines('Customer', customer));
	lines.push(DASH);
	lines.push(itemHeader());

	if (details.length === 0) {
		lines.push(fitLeft('(belum ada barang)'));
	}

	details.forEach((detail) => {
		lines.push(...itemLines(detail));
	});

	lines.push(DASH, ...pairLines('TOTAL', plain(total)), ...pairLines('BAYAR', plain(paid)));

	if (debt > 0) {
		lines.push(...pairLines('SISA UTANG', plain(debt)));
	}

	if (change > 0) {
		lines.push(...pairLines('KEMBALIAN', plain(change)));
	}

	lines.push(
		DASH,
		fitLeft('Terima kasih telah'),
		fitLeft('berbelanja di toko kami.'),
		fitLeft('Jika ada masalah hubungi:'),
		fitLeft('0821 6032 3953'),
	);

	return lines;
}

function render(lines, message) {
	el.paper.replaceChildren();

	if (message) {
		const state = document.createElement('div');
		state.className = 'state';
		state.textContent = message;
		el.paper.appendChild(state);
		return;
	}

	lines.forEach((line, index) => {
		const node = document.createElement('div');
		node.textContent = line;
		if (index === 0) node.className = 'center';
		el.paper.appendChild(node);
	});
}

async function request(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

	try {
		const res = await fetch(url, { signal: controller.signal });
		const text = await res.text();
		let data = null;

		if (text) {
			try {
				data = JSON.parse(text);
			} catch {
				data = null;
			}
		}

		if (!res.ok) {
			throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
		}

		return data;
	} finally {
		clearTimeout(timer);
	}
}

async function load() {
	if (!invoiceId) {
		render(null, 'Nomor struk tidak valid.');
		el.tip.textContent = 'Nomor struk tidak valid.';
		return;
	}

	try {
		const [invoices, details] = await Promise.all([
			request(API.invoices),
			request(API.details(invoiceId)),
		]);

		const list = Array.isArray(invoices) ? invoices : [];
		const invoice = list.find((item) => String(item.id_invoice) === String(invoiceId));

		if (!invoice) {
			render(null, 'Faktur tidak ditemukan.');
			el.tip.textContent = 'Faktur tidak ditemukan.';
			return;
		}

		const lines = buildLines(invoice, Array.isArray(details) ? details : []);
		render(lines);
		el.tip.textContent = `Struk #${invoice.id_invoice} siap dicetak.`;
		printOnce();
	} catch (error) {
		render(null, `Gagal memuat struk: ${error.message}`);
		el.tip.textContent = `Gagal memuat struk: ${error.message}`;
	}
}

function printOnce() {
	if (typeof window.print !== 'function') return;
	setTimeout(() => window.print(), 250);
}

el.printBtn.addEventListener('click', () => window.print());
el.closeBtn.addEventListener('click', () => window.close());

load();
