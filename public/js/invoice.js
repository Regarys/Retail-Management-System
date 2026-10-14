'use strict';

const API = {
	list: '/invoice',
	create: '/invoice/create',
	remove: (id) => `/invoice/delete/${encodeURIComponent(id)}`,
	products: '/product',
};

const PRODUCTS_CACHE_KEY = 'jerjon_products';

const REQUEST_TIMEOUT = 8000;
const TOAST_DURATION = 3500;

const state = {
	invoices: [],
	loading: false,
	query: '',
	filter: 'default',
	pendingDelete: null,
};

const el = {
	form: document.getElementById('invoiceForm'),
	customer: document.getElementById('customerName'),
	submit: document.getElementById('submitBtn'),
	reset: document.getElementById('resetBtn'),
	search: document.getElementById('searchInput'),
	filter: document.getElementById('filterSelect'),
	refresh: document.getElementById('refreshBtn'),
	productBtn: document.getElementById('productBtn'),
	tbody: document.getElementById('invoiceBody'),
	tableWrap: document.getElementById('tableWrap'),
	count: document.getElementById('countBadge'),
	modal: document.getElementById('deleteModal'),
	modalText: document.getElementById('deleteText'),
	modalCancel: document.getElementById('deleteCancel'),
	modalConfirm: document.getElementById('deleteConfirm'),
	toasts: document.getElementById('toasts'),
	errorCustomer: document.getElementById('errCustomer'),
};

const COLUMN_COUNT = 4;

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

function toast(message, variant = 'success') {
	const node = document.createElement('div');
	node.className = variant === 'error' ? 'toast error' : 'toast';
	node.textContent = message;
	el.toasts.appendChild(node);
	setTimeout(() => node.remove(), TOAST_DURATION);
}

/* ---------- form ---------- */

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

function validate() {
	const customer = el.customer.value.trim();
	setError(el.customer, el.errorCustomer, customer ? '' : 'Nama customer wajib diisi.');
	return Boolean(customer);
}

async function handleSubmit(event) {
	event.preventDefault();
	if (!validate()) return;

	const customerName = el.customer.value.trim();
	el.submit.disabled = true;
	el.reset.disabled = true;

	try {
		const result = await request(API.create, { method: 'POST', body: { customer_name: customerName } });
		const invoice = result && result.data;
		if (!invoice) throw new Error('Faktur gagal dibuat.');

		el.form.reset();
		setError(el.customer, el.errorCustomer, '');
		toast('Faktur dibuat, membuka halaman detail...');
		await loadInvoices({ silent: true });
		// detail page tidak pernah memanggil /product sendiri, jadi siapkan di sini
		await ensureProducts();
		setTimeout(() => {
			window.location.href = `/detail_page/${invoice.id_invoice}`;
		}, 450);
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		el.submit.disabled = false;
		el.reset.disabled = false;
	}
}

/* ---------- list ---------- */

function remainingDebt(invoice) {
	return Math.max(0, Number(invoice.total_price) - Number(invoice.paid));
}

// belum lunas = ngutan penuh (paid 0) atau bayar sebagian
const isOutstanding = (invoice) => Number(invoice.paid) === 0 || remainingDebt(invoice) > 0;

function timeOf(invoice) {
	const stamp = Date.parse(invoice.created_at);
	return Number.isFinite(stamp) ? stamp : Number(invoice.id_invoice) || 0;
}

const byNewest = (a, b) => timeOf(b) - timeOf(a) || Number(b.id_invoice) - Number(a.id_invoice);
const byOldest = (a, b) => timeOf(a) - timeOf(b) || Number(a.id_invoice) - Number(b.id_invoice);

function visibleInvoices() {
	const query = state.query.trim().toLowerCase();
	const rows = query === ''
		? state.invoices.slice()
		: state.invoices.filter((invoice) => String(invoice.customer_name || '').toLowerCase().includes(query));

	if (state.filter === 'unpaid') return rows.filter(isOutstanding).sort(byOldest);
	if (state.filter === 'newest') return rows.sort(byNewest);
	if (state.filter === 'oldest') return rows.sort(byOldest);
	return rows;
}

function emptyStateFor() {
	if (state.query.trim() !== '') {
		return ['Tidak ada yang cocok', 'Coba kata kunci lain.'];
	}

	if (state.filter === 'unpaid') {
		return ['Tidak ada faktur belum bayar', 'Semua faktur sudah lunas.'];
	}

	if (state.filter !== 'default') {
		return ['Belum ada faktur', 'Tambahkan faktur pertama lewat form di samping.'];
	}

	return ['Belum ada faktur', 'Tambahkan faktur pertama lewat form di samping.'];
}

function cell(text, className) {
	const td = document.createElement('td');
	td.className = className;
	td.textContent = text;
	return td;
}

function payLine(label, value) {
	const row = document.createElement('div');
	row.className = 'pay-line';

	const name = document.createElement('span');
	name.className = 'pay-label';
	name.textContent = label;

	const amount = document.createElement('span');
	amount.className = 'pay-value';
	amount.textContent = value;

	row.append(name, amount);
	return row;
}

function warningLine(text) {
	const node = document.createElement('div');
	node.className = 'pay-unpaid';
	node.textContent = text;
	return node;
}

function buildPaymentCell(invoice) {
	const td = document.createElement('td');
	td.className = 'pay';
	td.appendChild(payLine('Total', money(invoice.total_price)));

	const paid = Number(invoice.paid);
	const debt = remainingDebt(invoice);

	if (paid === 0) {
		td.appendChild(warningLine('(Belum Bayar)'));
	} else {
		td.appendChild(payLine('Bayar', money(paid)));

		if (debt > 0) {
			td.appendChild(warningLine(`Sisa Utang ${money(debt)}`));
		} else {
			td.appendChild(payLine('Kembalian', money(invoice.return_price)));
		}
	}

	const date = document.createElement('div');
	date.className = 'pay-date';
	date.textContent = formatDate(invoice.created_at);
	td.appendChild(date);

	return td;
}

function buildRow(invoice, index) {
	const row = document.createElement('tr');
	const id = invoice.id_invoice;
	const name = invoice.customer_name === null || invoice.customer_name === undefined || invoice.customer_name === ''
		? '-'
		: invoice.customer_name;

	row.appendChild(cell(String(index + 1), 'muted'));

	const nameTd = document.createElement('td');
	nameTd.className = 'name';
	nameTd.appendChild(document.createTextNode(name));

	if (Number(invoice.total_price) === 0) {
		const draft = document.createElement('span');
		draft.className = 'badge badge-draft';
		draft.textContent = 'Draft';
		nameTd.appendChild(draft);
	}
	row.appendChild(nameTd);

	row.appendChild(buildPaymentCell(invoice));

	const actions = document.createElement('td');
	const group = document.createElement('div');
	group.className = 'row-actions';

	const detailBtn = document.createElement('button');
	detailBtn.type = 'button';
	detailBtn.className = 'btn btn-sm edit';
	detailBtn.textContent = 'Detail';
	detailBtn.dataset.action = 'detail';
	detailBtn.dataset.id = String(id);

	const deleteBtn = document.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.className = 'btn btn-sm delete';
	deleteBtn.textContent = 'Hapus';
	deleteBtn.dataset.action = 'delete';
	deleteBtn.dataset.id = String(id);

	group.append(detailBtn, deleteBtn);
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

function render() {
	const rows = visibleInvoices();
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
	} else if (rows.length === 0) {
		const [strong, message] = emptyStateFor();
		el.tbody.appendChild(buildStateRow(message, strong));
	} else {
		rows.forEach((invoice, index) => el.tbody.appendChild(buildRow(invoice, index)));
	}

	const total = state.invoices.length;
	const filtering = state.query.trim() !== '' || state.filter !== 'default';
	el.count.textContent = filtering ? `${rows.length} dari ${total} Faktur` : `${total} Faktur`;
}

async function loadInvoices({ silent = false } = {}) {
	state.loading = true;
	el.refresh.disabled = true;
	render();

	try {
		const data = await request(API.list);
		state.invoices = Array.isArray(data) ? data : [];
		if (!silent) toast(`Memuat ${state.invoices.length} faktur.`);
	} catch (error) {
		state.invoices = [];
		toast(error.message, 'error');
	} finally {
		state.loading = false;
		el.refresh.disabled = false;
		render();
	}
}

/* ---------- products for the detail page ---------- */

function readCachedProducts() {
	try {
		const raw = window.sessionStorage.getItem(PRODUCTS_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function cacheProducts(products) {
	try {
		window.sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
	} catch {
		// storage penuh / diblokir, detail page akan tampil tanpa saran
	}
}

async function ensureProducts() {
	if (readCachedProducts() !== null) return true;

	try {
		const data = await request(API.products);
		cacheProducts(Array.isArray(data) ? data : []);
		return true;
	} catch (error) {
		toast(error.message, 'error');
		return false;
	}
}

async function handleTableClick(event) {
	const button = event.target.closest('button[data-action]');
	if (!button) return;

	const invoice = state.invoices.find((item) => String(item.id_invoice) === button.dataset.id);
	if (!invoice) {
		toast('Faktur tidak ditemukan di daftar.', 'error');
		return;
	}

	if (button.dataset.action === 'detail') {
		button.disabled = true;
		const ready = await ensureProducts();
		button.disabled = false;
		if (!ready) return;
		window.location.href = `/detail_page/${invoice.id_invoice}`;
		return;
	}

	if (button.dataset.action === 'delete') {
		askDelete(invoice);
	}
}

/* ---------- delete modal ---------- */

function askDelete(invoice) {
	const name = invoice.customer_name === null || invoice.customer_name === undefined || invoice.customer_name === ''
		? 'Faktur tanpa nama'
		: invoice.customer_name;
	el.modalText.textContent = `"${name}" akan dihapus permanen beserta detail barangnya.`;
	state.pendingDelete = invoice;
	el.modal.hidden = false;
	el.modalConfirm.focus();
}

function closeModal(confirmed) {
	const invoice = state.pendingDelete;
	state.pendingDelete = null;
	el.modal.hidden = true;
	if (invoice && confirmed) removeInvoice(invoice);
}

async function removeInvoice(invoice) {
	try {
		const result = await request(API.remove(invoice.id_invoice), { method: 'DELETE' });
		if (result && result.deleted_data) {
			const details = Number(result.deleted_details) || 0;
			toast(details > 0
				? `${result.message || 'Faktur dihapus'} (${details} detail ikut terhapus).`
				: (result.message || 'Faktur dihapus.'));
			await loadInvoices({ silent: true });
		} else {
			toast('Faktur sudah tidak ada di database.', 'error');
			await loadInvoices({ silent: true });
		}
	} catch (error) {
		toast(error.message, 'error');
	}
}

/* ---------- events ---------- */

function moveToProductPage() {
	window.location.href = '/products';
}

el.form.addEventListener('submit', handleSubmit);
el.reset.addEventListener('click', () => {
	el.form.reset();
	setError(el.customer, el.errorCustomer, '');
});
el.search.addEventListener('input', () => {
	state.query = el.search.value;
	render();
});
el.filter.addEventListener('change', () => {
	state.filter = el.filter.value;
	render();
});
el.refresh.addEventListener('click', () => loadInvoices());
el.productBtn.addEventListener('click', () => moveToProductPage());
el.tbody.addEventListener('click', handleTableClick);
el.modal.addEventListener('click', (event) => {
	if (event.target.hasAttribute('data-close')) closeModal(false);
});
el.modalCancel.addEventListener('click', () => closeModal(false));
el.modalConfirm.addEventListener('click', () => closeModal(true));

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !el.modal.hidden) closeModal(false);
});

render();
loadInvoices({ silent: true });
