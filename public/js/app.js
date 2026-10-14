'use strict';

const API = {
	list: '/product',
	create: '/product/create',
	update: (id) => `/product/update/${encodeURIComponent(id)}`,
	remove: (id) => `/product/delete/${encodeURIComponent(id)}`,
};

const REQUEST_TIMEOUT = 8000;
const TOAST_DURATION = 3500;

const state = {
	products: [],
	loading: false,
	editingId: null,
	query: '',
	pendingDelete: null,
};

const el = {
	form: document.getElementById('productForm'),
	formTitle: document.getElementById('formTitle'),
	editBadge: document.getElementById('editBadge'),
	name: document.getElementById('nameProduct'),
	price: document.getElementById('price'),
	priceTotal: document.getElementById('priceTotal'),
	submit: document.getElementById('submitBtn'),
	cancel: document.getElementById('cancelBtn'),
	reset: document.getElementById('resetBtn'),
	search: document.getElementById('searchInput'),
	refresh: document.getElementById('refreshBtn'),
	addInvoice: document.getElementById('addInvoiceBtn'),
	tbody: document.getElementById('productBody'),
	tableWrap: document.getElementById('tableWrap'),
	count: document.getElementById('countBadge'),
	modal: document.getElementById('deleteModal'),
	modalText: document.getElementById('deleteText'),
	modalCancel: document.getElementById('deleteCancel'),
	modalConfirm: document.getElementById('deleteConfirm'),
	toasts: document.getElementById('toasts'),
	errors: {
		name: document.getElementById('errName'),
		price: document.getElementById('errPrice'),
		priceTotal: document.getElementById('errTotal'),
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

function clearErrors() {
	setError(el.name, el.errors.name, '');
	setError(el.price, el.errors.price, '');
	setError(el.priceTotal, el.errors.priceTotal, '');
}

function validate() {
	clearErrors();
	const name = el.name.value.trim();
	const price = el.price.value.trim();
	const total = el.priceTotal.value.trim();
	let valid = true;

	if (!name) {
		setError(el.name, el.errors.name, 'Nama barang wajib diisi.');
		valid = false;
	}

	if (price !== '' && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
		setError(el.price, el.errors.price, 'Harga harus angka 0 atau lebih.');
		valid = false;
	}

	if (total === '') {
		setError(el.priceTotal, el.errors.priceTotal, 'Total wajib diisi.');
		valid = false;
	} else if (!Number.isFinite(Number(total)) || Number(total) < 0) {
		setError(el.priceTotal, el.errors.priceTotal, 'Total harus angka 0 atau lebih.');
		valid = false;
	}

	return valid;
}

function setFormMode(editingId) {
	state.editingId = editingId;
	const editing = editingId !== null;

	el.formTitle.textContent = editing ? 'Ubah Produk' : 'Tambah Produk';
	el.submit.textContent = editing ? 'Update' : 'Simpan';
	el.editBadge.hidden = !editing;
	el.cancel.hidden = !editing;

	if (editing) {
		const product = state.products.find((item) => String(item.id_product) === String(editingId));
		if (product) {
			el.name.value = product.name_product;
			el.price.value = product.price === null || product.price === undefined ? '' : String(product.price);
			el.priceTotal.value = product.price_total === null || product.price_total === undefined
				? ''
				: String(product.price_total);
		}
		el.name.focus();
	}
}

function resetForm() {
	el.form.reset();
	clearErrors();
	setFormMode(null);
}

async function handleSubmit(event) {
	event.preventDefault();
	if (!validate()) return;

	const payload = {
		name_product: el.name.value.trim(),
		price_total: Number(el.priceTotal.value),
		price: el.price.value.trim() === '' ? null : Number(el.price.value),
	};

	const editingId = state.editingId;
	el.submit.disabled = true;
	el.reset.disabled = true;

	try {
		const result = editingId !== null
			? await request(API.update(editingId), { method: 'PUT', body: payload })
			: await request(API.create, { method: 'POST', body: payload });

		if (editingId !== null && !(result && result.updated_data)) {
			toast('Produk tidak ditemukan, mungkin sudah dihapus.', 'error');
		} else {
			toast((result && result.message) || 'Tersimpan.');
		}

		resetForm();
		await loadProducts({ silent: true });
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		el.submit.disabled = false;
		el.reset.disabled = false;
	}
}

/* ---------- list ---------- */

function filteredProducts() {
	const query = state.query.trim().toLowerCase();
	if (!query) return state.products;
	return state.products.filter((product) => String(product.name_product || '').toLowerCase().includes(query));
}

function buildRow(product, index) {
	const row = document.createElement('tr');
	const id = product.id_product;

	const no = document.createElement('td');
	no.className = 'muted';
	no.textContent = String(index + 1);

	const name = document.createElement('td');
	name.className = 'name';
	name.textContent = product.name_product;

	const price = document.createElement('td');
	price.className = 'num';
	price.textContent = product.price === null || product.price === undefined ? '-' : money(product.price);

	const total = document.createElement('td');
	total.className = 'num';
	total.textContent = money(product.price_total);

	const created = document.createElement('td');
	created.className = 'muted hide-sm';
	created.textContent = formatDate(product.created_at);

	const actions = document.createElement('td');
	const group = document.createElement('div');
	group.className = 'row-actions';

	const editBtn = document.createElement('button');
	editBtn.type = 'button';
	editBtn.className = 'btn btn-ghost btn-sm edit';
	editBtn.textContent = 'Edit';
	editBtn.dataset.action = 'edit';
	editBtn.dataset.id = String(id);

	const deleteBtn = document.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.className = 'btn btn-ghost btn-sm delete';
	deleteBtn.textContent = 'Hapus';
	deleteBtn.dataset.action = 'delete';
	deleteBtn.dataset.id = String(id);

	group.append(editBtn, deleteBtn);
	actions.appendChild(group);
	row.append(no, name, price, total, created, actions);
	return row;
}

function buildStateRow(message, strong) {
	const row = document.createElement('tr');
	const cell = document.createElement('td');
	cell.colSpan = 6;
	cell.className = 'state';

	if (strong) {
		const title = document.createElement('strong');
		title.textContent = strong;
		cell.appendChild(title);
	}

	cell.appendChild(document.createTextNode(message));
	row.appendChild(cell);
	return row;
}

function render() {
	const rows = filteredProducts();
	el.tbody.replaceChildren();

	if (state.loading) {
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		cell.colSpan = 6;
		cell.className = 'state';
		const spinner = document.createElement('div');
		spinner.className = 'spinner';
		cell.append(spinner, document.createTextNode('Memuat data...'));
		row.appendChild(cell);
		el.tbody.appendChild(row);
	} else if (rows.length === 0) {
		const searching = state.query.trim() !== '';
		el.tbody.appendChild(buildStateRow(
			searching ? 'Coba kata kunci lain.' : 'Tambahkan produk pertama lewat form di samping.',
			searching ? 'Tidak ada yang cocok' : 'Belum ada produk'
		));
	} else {
		rows.forEach((product, index) => el.tbody.appendChild(buildRow(product, index)));
	}

	const total = state.products.length;
	el.count.textContent = state.query.trim() === ''
		? `${total} produk`
		: `${rows.length} dari ${total} produk`;
}

async function loadProducts({ silent = false } = {}) {
	state.loading = true;
	el.refresh.disabled = true;
	render();

	try {
		const data = await request(API.list);
		state.products = Array.isArray(data) ? data : [];
		if (!silent) toast(`Memuat ${state.products.length} produk.`);
	} catch (error) {
		state.products = [];
		toast(error.message, 'error');
	} finally {
		state.loading = false;
		el.refresh.disabled = false;
		render();
	}
}

function moveToInvoice(){
	window.location.href = "invoice_page";
}

function handleTableClick(event) {
	const button = event.target.closest('button[data-action]');
	if (!button) return;

	const product = state.products.find((item) => String(item.id_product) === button.dataset.id);
	if (!product) {
		toast('Produk tidak ditemukan di daftar.', 'error');
		return;
	}

	if (button.dataset.action === 'edit') {
		clearErrors();
		setFormMode(product.id_product);
		if (typeof el.form.scrollIntoView === 'function') {
			el.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
		return;
	}

	if (button.dataset.action === 'delete') {
		askDelete(product);
	}
}

/* ---------- delete modal ---------- */

function askDelete(product) {
	el.modalText.textContent = `"${product.name_product}" akan dihapus permanen dari database.`;
	state.pendingDelete = product;
	el.modal.hidden = false;
	el.modalConfirm.focus();
}

function closeModal(confirmed) {
	const product = state.pendingDelete;
	state.pendingDelete = null;
	el.modal.hidden = true;
	if (product && confirmed) removeProduct(product);
}

async function removeProduct(product) {
	try {
		const result = await request(API.remove(product.id_product), { method: 'DELETE' });
		if (result && result.deleted_data) {
			toast(result.message || 'Produk dihapus.');
			if (String(state.editingId) === String(product.id_product)) resetForm();
			await loadProducts({ silent: true });
		} else {
			toast('Produk sudah tidak ada di database.', 'error');
			await loadProducts({ silent: true });
		}
	} catch (error) {
		toast(error.message, 'error');
	}
}

/* ---------- events ---------- */

el.form.addEventListener('submit', handleSubmit);
el.reset.addEventListener('click', () => resetForm());
el.cancel.addEventListener('click', () => resetForm());
el.search.addEventListener('input', () => {
	state.query = el.search.value;
	render();
});
el.refresh.addEventListener('click', () => loadProducts());
el.addInvoice.addEventListener('click',() => moveToInvoice());
el.tbody.addEventListener('click', handleTableClick);
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
		resetForm();
	}
});

render();
loadProducts({ silent: true });
