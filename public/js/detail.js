'use strict';

const PRODUCTS_CACHE_KEY = 'jerjon_products';

const API = {
	invoices: '/invoice',
	details: (id) => `/invoice_detail/${encodeURIComponent(id)}`,
	create: '/invoice_detail/create',
	update: (id) => `/invoice_detail/update/${encodeURIComponent(id)}`,
	remove: (id) => `/invoice_detail/delete/${encodeURIComponent(id)}`,
	updateInvoice: (id) => `/invoice/update/${encodeURIComponent(id)}`,
};

const REQUEST_TIMEOUT = 8000;
const TOAST_DURATION = 3500;
const SUGGEST_LIMIT = 8;
const COLUMN_COUNT = 6;

const invoiceId = (window.location.pathname.split('/').filter(Boolean).pop() || '').trim();

const state = {
	invoice: null,
	details: [],
	products: [],
	productsLoaded: false,
	loading: false,
	editingId: null,
	pendingDelete: null,
};

const el = {
	metaNo: document.getElementById('metaNo'),
	metaCreated: document.getElementById('metaCreated'),
	metaItems: document.getElementById('metaItems'),
	payForm: document.getElementById('paymentForm'),
	customer: document.getElementById('customerName'),
	total: document.getElementById('totalPrice'),
	paid: document.getElementById('paid'),
	changeHint: document.getElementById('changeHint'),
	paySubmit: document.getElementById('paySubmit'),
	printBtn: document.getElementById('printBtn'),
	search: document.getElementById('productSearch'),
	suggest: document.getElementById('suggestList'),
	productHint: document.getElementById('productHint'),
	lineForm: document.getElementById('lineForm'),
	lineBadge: document.getElementById('lineBadge'),
	lineProduct: document.getElementById('lineProduct'),
	lineQty: document.getElementById('lineQty'),
	linePrice: document.getElementById('linePrice'),
	lineTotal: document.getElementById('lineTotal'),
	lineSubmit: document.getElementById('lineSubmit'),
	lineCancel: document.getElementById('lineCancel'),
	tbody: document.getElementById('detailBody'),
	tfoot: document.getElementById('detailFoot'),
	linesBadge: document.getElementById('linesBadge'),
	backBtn: document.getElementById('backBtn'),
	productBtn: document.getElementById('productBtn'),
	modal: document.getElementById('deleteModal'),
	modalText: document.getElementById('deleteText'),
	modalCancel: document.getElementById('deleteCancel'),
	modalConfirm: document.getElementById('deleteConfirm'),
	toasts: document.getElementById('toasts'),
	errors: {
		customer: document.getElementById('errCustomer'),
		paid: document.getElementById('errPaid'),
		qty: document.getElementById('errQty'),
		price: document.getElementById('errPrice'),
	},
};

const rupiah = new Intl.NumberFormat('id-ID', {
	style: 'currency',
	currency: 'IDR',
	maximumFractionDigits: 0,
});

/* ---------- helpers ---------- */

async function request(url, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
	const init = { method: options.method || 'GET', signal: controller.signal };

	if (options.body !== undefined) {
		init.headers = { 'Content-Type': 'application/json' };
		init.body = JSON.stringify(options.body);
	}

	try {
		const res = await fetch(url, init);
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
			const message = (data && (data.error || data.message)) || `Permintaan gagal (HTTP ${res.status}).`;
			throw new Error(message);
		}

		return data;
	} catch (error) {
		if (error.name === 'AbortError') {
			throw new Error('Server tidak merespons (timeout).');
		}
		if (error.name === 'TypeError') {
			throw new Error('Tidak bisa menghubungi server. Pastikan server sedang berjalan.');
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

function money(value) {
	const number = Number(value);
	return Number.isFinite(number) ? rupiah.format(number) : '-';
}

function formatDate(value) {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function toast(message, variant = 'success') {
	const node = document.createElement('div');
	node.className = variant === 'error' ? 'toast error' : 'toast';
	node.textContent = message;
	el.toasts.appendChild(node);
	setTimeout(() => node.remove(), TOAST_DURATION);
}

function setError(input, node, message) {
	if (message) {
		input.classList.add('invalid');
		node.textContent = message;
		node.hidden = false;
	} else {
		input.classList.remove('invalid');
		node.textContent = '';
		node.hidden = true;
	}
}

function readNumber(input) {
	const raw = input.value.trim();
	if (raw === '') return null;
	const number = Number(raw);
	return Number.isFinite(number) ? number : null;
}

/* ---------- products (datang dari halaman faktur, tidak diambil ulang) ---------- */

function loadCachedProducts() {
	let cached = null;
	try {
		const raw = window.sessionStorage.getItem(PRODUCTS_CACHE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			cached = Array.isArray(parsed) ? parsed : null;
		}
	} catch {
		cached = null;
	}

	state.products = cached || [];
	state.productsLoaded = cached !== null;
	el.search.disabled = !state.productsLoaded || state.products.length === 0;

	if (state.products.length === 0) {
		el.productHint.textContent = state.productsLoaded
			? 'Belum ada produk di daftar. Tulis nama barang sendiri di bawah.'
			: 'Produk belum dimuat. Tidak apa-apa, tulis nama barang sendiri di bawah.';
	} else {
		el.productHint.textContent = 'Pilih dari saran, atau ketik nama barang sendiri di bawah.';
	}

	hideSuggest();
}

function findProducts(query) {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	return state.products
		.filter((product) => String(product.name_product || '').toLowerCase().includes(needle))
		.slice(0, SUGGEST_LIMIT);
}

function showSuggest(list) {
	el.suggest.replaceChildren();

	if (state.products.length === 0) {
		hideSuggest();
		return;
	}

	if (!list.length) {
		const empty = document.createElement('p');
		empty.className = 'suggest-empty';
		empty.textContent = 'Produk tidak ditemukan.';
		el.suggest.appendChild(empty);
		el.suggest.hidden = false;
		return;
	}

	list.forEach((product) => {
		const item = document.createElement('button');
		item.type = 'button';
		item.className = 'suggest-item';
		item.dataset.id = String(product.id_product);

		const name = document.createElement('span');
		name.className = 'suggest-name';
		name.textContent = product.name_product;

		const price = document.createElement('span');
		price.className = 'suggest-price';
		const unit = product.price === null || product.price === undefined ? product.price_total : product.price;
		price.textContent = money(unit);

		item.append(name, price);
		el.suggest.appendChild(item);
	});

	el.suggest.hidden = false;
}

function hideSuggest() {
	el.suggest.replaceChildren();
	el.suggest.hidden = true;
}

/* ---------- line form ---------- */

function productPrice(product) {
	const price = product.price === null || product.price === undefined ? product.price_total : product.price;
	const number = Number(price);
	return Number.isFinite(number) ? number : 0;
}

function updateLineTotal() {
	const qty = readNumber(el.lineQty);
	const price = readNumber(el.linePrice);
	if (qty === null || price === null) {
		el.lineTotal.value = '';
		return;
	}
	el.lineTotal.value = String(qty * price);
}

function setLineMode(detail) {
	state.editingId = detail ? detail.id_detail : null;
	const editing = Boolean(detail);

	el.lineBadge.hidden = !editing;
	el.lineCancel.hidden = !editing;
	el.lineSubmit.textContent = editing ? 'Update' : 'Tambah';
	el.search.disabled = editing || !state.productsLoaded || state.products.length === 0;
	hideSuggest();

	if (editing) {
		el.lineProduct.value = detail.product_name;
		el.lineQty.value = String(detail.qty);
		el.linePrice.value = detail.price === null || detail.price === undefined ? '' : String(detail.price);
		el.lineQty.focus();
	} else {
		el.lineForm.reset();
		el.lineQty.value = '1';
		el.linePrice.value = '';
		el.lineTotal.value = '';
	}
	updateLineTotal();
	clearLineErrors();
}

function clearLineErrors() {
	setError(el.lineQty, el.errors.qty, '');
	setError(el.linePrice, el.errors.price, '');
}

function pickProduct(product) {
	state.editingId = null;
	el.lineBadge.hidden = true;
	el.lineCancel.hidden = true;
	el.lineSubmit.textContent = 'Tambah';
	el.lineProduct.value = product.name_product;
	el.lineQty.value = '1';
	el.linePrice.value = String(productPrice(product));
	updateLineTotal();
	hideSuggest();
	el.search.value = '';
	el.search.disabled = false;
	el.lineQty.focus();
}

function validateLine() {
	clearLineErrors();
	let valid = true;

	if (!el.lineProduct.value.trim()) {
		toast('Isi nama barang dulu (pilih dari saran atau ketik sendiri).', 'error');
		valid = false;
	}

	const qty = readNumber(el.lineQty);
	if (qty === null || qty < 1 || !Number.isInteger(qty)) {
		setError(el.lineQty, el.errors.qty, 'Qty harus bilangan bulat 1 atau lebih.');
		valid = false;
	}

	const price = readNumber(el.linePrice);
	if (price === null || price < 0) {
		setError(el.linePrice, el.errors.price, 'Harga harus angka 0 atau lebih.');
		valid = false;
	}

	return valid;
}

async function handleLineSubmit(event) {
	event.preventDefault();
	if (!validateLine()) return;

	const qty = Number(el.lineQty.value);
	const price = Number(el.linePrice.value);
	const payload = {
		product_name: el.lineProduct.value.trim(),
		qty,
		price,
		total: qty * price,
	};

	const editingId = state.editingId;
	el.lineSubmit.disabled = true;

	try {
		const result = editingId !== null
			? await request(API.update(editingId), { method: 'PUT', body: payload })
			: await request(API.create, { method: 'POST', body: { id_invoice: invoiceId, ...payload } });

		if (editingId !== null && !(result && result.updated_data)) {
			toast('Detail tidak ditemukan, mungkin sudah dihapus.', 'error');
		} else {
			toast((result && result.message) || 'Tersimpan.');
		}

		applyInvoice(result && result.invoice);
		setLineMode(null);
		await loadDetails();
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		el.lineSubmit.disabled = false;
	}
}

/* ---------- payment ---------- */

function invoiceTotal() {
	return state.invoice ? Number(state.invoice.total_price) : 0;
}

// field Bayar kosong berarti 0 (ngutan penuh)
function paidValue() {
	const paid = readNumber(el.paid);
	return paid === null || paid < 0 ? 0 : paid;
}

function remainingDebt() {
	return Math.max(0, invoiceTotal() - paidValue());
}

function updateChangeHint() {
	if (state.details.length === 0) {
		el.changeHint.classList.remove('debt');
		el.changeHint.textContent = 'Belum ada barang, total masih Rp 0.';
		return;
	}

	const change = paidValue() - invoiceTotal();
	el.changeHint.classList.toggle('debt', change < 0);
	el.changeHint.textContent = change < 0
		? `Sisa Utang: ${rupiah.format(-change)}`
		: `Kembalian: ${rupiah.format(change)}`;
}

function updatePaymentLock() {
	const hasItems = state.details.length > 0;
	el.paid.disabled = !hasItems;
	el.paySubmit.disabled = !hasItems;
}

function applyInvoice(invoice) {
	if (invoice) state.invoice = invoice;
	if (!state.invoice) return;

	el.metaNo.textContent = `#${state.invoice.id_invoice}`;
	el.metaCreated.textContent = `${formatDate(state.invoice.created_at)} ${formatTime(state.invoice.created_at)}`;

	if (document.activeElement !== el.customer) {
		el.customer.value = state.invoice.customer_name || '';
	}
	el.total.value = String(invoiceTotal());

	if (document.activeElement !== el.paid) {
		el.paid.value = state.invoice.paid === null || state.invoice.paid === undefined ? '' : String(state.invoice.paid);
	}

	updatePaymentLock();
	updateChangeHint();
}

async function handlePaymentSubmit(event) {
	event.preventDefault();
	setError(el.customer, el.errors.customer, '');
	setError(el.paid, el.errors.paid, '');

	const total = invoiceTotal();
	const paid = paidValue();
	let valid = true;

	if (!el.customer.value.trim()) {
		setError(el.customer, el.errors.customer, 'Nama customer wajib diisi.');
		valid = false;
	}

	if (state.details.length === 0) {
		toast('Tambahkan barang dulu sebelum menyimpan pembayaran.', 'error');
		valid = false;
	} else if (readNumber(el.paid) !== null && readNumber(el.paid) < 0) {
		setError(el.paid, el.errors.paid, 'Bayar tidak boleh minus.');
		valid = false;
	}

	if (!valid) return;

	const debt = Math.max(0, total - paid);
	const payload = {
		customer_name: el.customer.value.trim(),
		paid,
		return_price: Math.max(paid - total, 0),
	};

	el.paySubmit.disabled = true;
	try {
		const result = await request(API.updateInvoice(invoiceId), { method: 'PUT', body: payload });
		if (!(result && result.updated_data)) {
			toast('Faktur tidak ditemukan, mungkin sudah dihapus.', 'error');
			return;
		}
		toast(debt > 0 ? `Tersimpan. Sisa utang ${rupiah.format(debt)}.` : (result.message || 'Pembayaran disimpan.'));
		applyInvoice(result.updated_data);
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		updatePaymentLock();
	}
}

/* ---------- detail table ---------- */

function cell(text, className) {
	const td = document.createElement('td');
	td.className = className;
	td.textContent = text;
	return td;
}

function buildRow(detail, index) {
	const row = document.createElement('tr');

	row.appendChild(cell(String(index + 1), 'muted'));
	row.appendChild(cell(detail.product_name, 'name'));
	row.appendChild(cell(String(detail.qty), 'num'));
	row.appendChild(cell(money(detail.price), 'num'));
	row.appendChild(cell(money(detail.total), 'num'));

	const actions = document.createElement('td');
	const group = document.createElement('div');
	group.className = 'row-actions';

	const editBtn = document.createElement('button');
	editBtn.type = 'button';
	editBtn.className = 'btn btn-sm edit';
	editBtn.textContent = 'Edit';
	editBtn.dataset.action = 'edit';
	editBtn.dataset.id = String(detail.id_detail);

	const deleteBtn = document.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.className = 'btn btn-sm delete';
	deleteBtn.textContent = 'Hapus';
	deleteBtn.dataset.action = 'delete';
	deleteBtn.dataset.id = String(detail.id_detail);

	group.append(editBtn, deleteBtn);
	actions.appendChild(group);
	row.appendChild(actions);
	return row;
}

function buildStateRow(message, strong) {
	const row = document.createElement('tr');
	const td = document.createElement('td');
	td.colSpan = COLUMN_COUNT;
	td.className = 'state';

	if (strong) {
		const title = document.createElement('strong');
		title.textContent = strong;
		td.appendChild(title);
	}

	td.appendChild(document.createTextNode(message));
	row.appendChild(td);
	return row;
}

function renderFoot(sum) {
	el.tfoot.replaceChildren();
	if (state.details.length === 0) return;

	const row = document.createElement('tr');
	const label = document.createElement('td');
	label.colSpan = 4;
	label.className = 'table-footer-label';
	label.textContent = 'Grand Total';

	const total = document.createElement('td');
	total.className = 'num table-footer-total';
	total.textContent = money(sum);

	const empty = document.createElement('td');
	empty.className = 'table-footer-empty';

	row.append(label, total, empty);
	el.tfoot.appendChild(row);
}

function render() {
	el.tbody.replaceChildren();

	if (state.loading) {
		const row = document.createElement('tr');
		const td = document.createElement('td');
		td.colSpan = COLUMN_COUNT;
		td.className = 'state';
		const spinner = document.createElement('div');
		spinner.className = 'spinner';
		td.append(spinner, document.createTextNode('Memuat data...'));
		row.appendChild(td);
		el.tbody.appendChild(row);
	} else if (state.details.length === 0) {
		el.tbody.appendChild(buildStateRow('Cari produk di atas, lalu klik untuk menambahkan barang.', 'Belum ada detail'));
	}

	if (!state.loading && state.details.length > 0) {
		state.details.forEach((detail, index) => el.tbody.appendChild(buildRow(detail, index)));
	}

	const count = state.details.length;
	const sum = state.details.reduce((acc, detail) => acc + (Number(detail.total) || 0), 0);
	el.linesBadge.textContent = count === 0 ? '0 item' : `${count} item`;
	el.metaItems.textContent = String(count);
	renderFoot(sum);
}

async function loadDetails() {
	state.loading = true;
	render();

	try {
		const data = await request(API.details(invoiceId));
		state.details = Array.isArray(data) ? data : [];
	} catch (error) {
		state.details = [];
		toast(error.message, 'error');
	} finally {
		state.loading = false;
		render();
		updatePaymentLock();
		updateChangeHint();
	}
}

async function loadInvoice() {
	try {
		const data = await request(API.invoices);
		const invoices = Array.isArray(data) ? data : [];
		state.invoice = invoices.find((item) => String(item.id_invoice) === String(invoiceId)) || null;

		if (!state.invoice) {
			el.tbody.replaceChildren();
			el.tbody.appendChild(buildStateRow('Faktur ini tidak ada lagi di database.', 'Faktur tidak ditemukan'));
			toast('Faktur tidak ditemukan.', 'error');
			return;
		}
		applyInvoice(state.invoice);
	} catch (error) {
		toast(error.message, 'error');
	}
}

/* ---------- delete modal ---------- */

function askDelete(detail) {
	el.modalText.textContent = `"${detail.product_name}" akan dihapus dari faktur ini.`;
	state.pendingDelete = detail;
	el.modal.hidden = false;
	el.modalConfirm.focus();
}

function closeModal(confirmed) {
	const detail = state.pendingDelete;
	state.pendingDelete = null;
	el.modal.hidden = true;
	if (detail && confirmed) removeDetail(detail);
}

async function removeDetail(detail) {
	try {
		const result = await request(API.remove(detail.id_detail), { method: 'DELETE' });
		if (result && result.deleted_data) {
			toast(result.message || 'Barang dihapus.');
			if (String(state.editingId) === String(detail.id_detail)) setLineMode(null);
			applyInvoice(result.invoice);
			await loadDetails();
		} else {
			toast('Detail sudah tidak ada di database.', 'error');
			await loadDetails();
		}
	} catch (error) {
		toast(error.message, 'error');
	}
}

function handleTableClick(event) {
	const button = event.target.closest('button[data-action]');
	if (!button) return;

	const detail = state.details.find((item) => String(item.id_detail) === button.dataset.id);
	if (!detail) {
		toast('Detail tidak ditemukan di daftar.', 'error');
		return;
	}

	if (button.dataset.action === 'edit') {
		setLineMode(detail);
		if (typeof el.lineForm.scrollIntoView === 'function') {
			el.lineForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
		return;
	}

	if (button.dataset.action === 'delete') {
		askDelete(detail);
	}
}

/* ---------- events ---------- */

el.payForm.addEventListener('submit', handlePaymentSubmit);
el.paid.addEventListener('input', updateChangeHint);
el.lineForm.addEventListener('submit', handleLineSubmit);
el.lineQty.addEventListener('input', updateLineTotal);
el.linePrice.addEventListener('input', updateLineTotal);
el.lineCancel.addEventListener('click', () => setLineMode(null));
el.search.addEventListener('input', () => showSuggest(findProducts(el.search.value)));
el.search.addEventListener('focus', () => {
	if (state.products.length > 0 && el.search.value.trim()) showSuggest(findProducts(el.search.value));
});
el.suggest.addEventListener('click', (event) => {
	const button = event.target.closest('button[data-id]');
	if (!button) return;
	const product = state.products.find((item) => String(item.id_product) === button.dataset.id);
	if (product) pickProduct(product);
});
el.tbody.addEventListener('click', handleTableClick);
el.printBtn.addEventListener('click', () => {
	window.open(`/struk/${invoiceId}`, '_blank');
});
el.backBtn.addEventListener('click', () => {
	window.location.href = '/invoice_page';
});
el.productBtn.addEventListener('click', () => {
	window.location.href = '/';
});
el.modal.addEventListener('click', (event) => {
	if (event.target.hasAttribute('data-close')) closeModal(false);
});
el.modalCancel.addEventListener('click', () => closeModal(false));
el.modalConfirm.addEventListener('click', () => closeModal(true));

document.addEventListener('keydown', (event) => {
	if (event.key !== 'Escape') return;
	if (!el.modal.hidden) {
		closeModal(false);
	} else if (state.editingId !== null) {
		setLineMode(null);
	} else {
		hideSuggest();
	}
});

document.addEventListener('click', (event) => {
	if (!el.search.disabled && !event.target.closest('.picker')) hideSuggest();
});

loadCachedProducts();
render();
loadInvoice();
loadDetails();
