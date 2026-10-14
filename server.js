const express = require('express');
const session = require('express-session');
const db = require('./database');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT;
const username_previllage = process.env.USERNAME;
const password_previllage = process.env.PASSWORD;
const token_previllage = process.env.TOKEN;

app.use(express.json()); 
app.use((req, res, next) => {
    console.log(
        new Date().toLocaleString(),
        req.ip,
        req.method,
        req.originalUrl
    );
    next();
});

//Session Checker
app.use(session({
  secret: token_previllage,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static("public", { index: false }));
// FrontEnd Route
app.get('/', redirectIfAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/products', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'products.html'));
});
app.get('/invoice_page', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});
app.get('/detail_page/:id', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'detail_page.html'));
});
app.get('/struk/:id', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'struk.html'));
});

// invoices.total_price selalu dihitung ulang dari detail
const RECALC_TOTAL_SQL = `UPDATE invoices
	SET total_price = COALESCE((SELECT SUM(total) FROM invoice_details WHERE id_invoice = $1), 0)
	WHERE id_invoice = $1
	RETURNING *`;

async function recalcInvoiceTotal(client, id_invoice) {
	const result = await client.query(RECALC_TOTAL_SQL, [id_invoice]);
	return result.rows[0] || null;
}

// BackEnd Route 
// Product 
// Get Products
app.get('/product', requireAuth, async(req,res) =>{
	try{
		const result = await db.query('SELECT * FROM product');
		res.json(result.rows);
	}catch(error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

//Post Product
app.post('/product/create', requireAuth, async(req,res) =>{
	const { name_product, price_total, price } = req.body;
	try{
		const result = await db.query('INSERT INTO product (name_product, price_total, price) VALUES ($1,$2,$3) RETURNING *', [name_product, price_total, price]);

		res.status(201).json({
			message: 'Sucessfuly creating data to database',
			data: result.rows[0]
		})
	}catch (error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

//Delete Product
app.delete('/product/delete/:id', requireAuth, async(req,res) =>{
	const id = req.params.id;
	try{
		const result = await db.query('DELETE FROM product WHERE id_product= $1 RETURNING *', [id]);
		res.status(200).json({
			message: 'Delete successs',
			deleted_data: result.rows[0]
		});
	}catch(error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

//Update Product
app.put('/product/update/:id', requireAuth, async(req,res)=>{
	const id_product = req.params.id;
	const { name_product, price_total, price } = req.body;
	try{
		const result = await db.query('UPDATE product SET name_product = $1, price_total = $2, price = $3 WHERE id_product = $4 RETURNING *',[name_product, price_total, price, id_product]);
		res.status(200).json({
			message: 'Data updated',
			updated_data: result.rows[0]
		})
	}catch(error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

// Inovice 
// Get Invoices 
app.get('/invoice', requireAuth, async(req,res) =>{
	try{
		const result = await db.query('SELECT * FROM invoices');
		res.json(result.rows);
	}catch(error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

// Post Invoice
// total_price, paid, return_price boleh kosong, default 0
app.post('/invoice/create', requireAuth, async(req,res) =>{
	const { customer_name, total_price, paid, return_price } = req.body;
	try{
		const result = await db.query('INSERT INTO invoices (customer_name, total_price, paid, return_price ) VALUES ($1, COALESCE($2::numeric, 0), COALESCE($3::numeric, 0), COALESCE($4::numeric, 0)) RETURNING *', [customer_name, total_price, paid, return_price]);

		res.status(201).json({
			message: 'Sucessfuly creating data to database',
			data: result.rows[0]
		})
	}catch (error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

// Put Invoice
// total_price sengaja tidak diupdate, nilainya milik server (hasil SUM detail)
app.put('/invoice/update/:id', requireAuth, async(req,res)=>{
	const id_invoice = req.params.id;
	const { customer_name, paid, return_price } = req.body;
	try{
		const result = await db.query('UPDATE invoices SET customer_name = $1, paid = COALESCE($2::numeric, 0), return_price = COALESCE($3::numeric, 0) WHERE id_invoice = $4 RETURNING *',[customer_name, paid, return_price, id_invoice ]);
		res.status(200).json({
			message: 'Data updated',
			updated_data: result.rows[0]
		})
	}catch (error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

// Delete Invoice (detail ikut terhapus)
app.delete('/invoice/delete/:id', requireAuth, async(req,res) =>{
	const id = req.params.id;
	const client = await db.pool.connect();
	try{
		await client.query('BEGIN');
		const details = await client.query('DELETE FROM invoice_details WHERE id_invoice = $1 RETURNING id_detail', [id]);
		const result = await client.query('DELETE FROM invoices WHERE id_invoice = $1 RETURNING *', [id]);
		await client.query('COMMIT');

		res.status(200).json({
			message: 'Delete successs',
			deleted_data: result.rows[0],
			deleted_details: details.rowCount
		});
	}catch(error){
		await client.query('ROLLBACK');
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}finally{
		client.release();
	}
});

// Invoice Detail
// Get Detail satu invoice
app.get('/invoice_detail/:id', requireAuth, async(req,res)=>{
	try{
		const result = await db.query('SELECT * FROM invoice_details WHERE id_invoice = $1 ORDER BY id_detail', [req.params.id]);
		res.json(result.rows);
	}catch(error){
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}
});

// Post Detail
// total selalu dihitung server dari qty * price, nilai total dari body diabaikan
app.post('/invoice_detail/create', requireAuth, async(req,res)=>{
	const { id_invoice, product_name, qty, price } = req.body;
	const client = await db.pool.connect();
	try{
		await client.query('BEGIN');
		const result = await client.query('INSERT INTO invoice_details (id_invoice, product_name, qty, price, total) VALUES ($1,$2,$3,COALESCE($4::numeric, 0),COALESCE($3::int, 0) * COALESCE($4::numeric, 0)) RETURNING *', [id_invoice, product_name, qty, price]);
		const invoice = await recalcInvoiceTotal(client, id_invoice);
		await client.query('COMMIT');

		res.status(201).json({
			message: 'Sucessfuly creating data to database',
			data: result.rows[0],
			invoice: invoice
		})
	}catch (error){
		await client.query('ROLLBACK');
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}finally{
		client.release();
	}
});

// Put Detail
// total selalu dihitung server dari qty * price, nilai total dari body diabaikan
app.put('/invoice_detail/update/:id', requireAuth, async(req,res)=>{
	const id_detail = req.params.id;
	const { product_name, qty, price } = req.body;
	const client = await db.pool.connect();
	try{
		await client.query('BEGIN');
		const result = await client.query('UPDATE invoice_details SET product_name = $1, qty = $2, price = COALESCE($3::numeric, 0), total = COALESCE($2::int, 0) * COALESCE($3::numeric, 0) WHERE id_detail = $4 RETURNING *', [product_name, qty, price, id_detail]);
		const invoice = result.rows[0] ? await recalcInvoiceTotal(client, result.rows[0].id_invoice) : null;
		await client.query('COMMIT');

		res.status(200).json({
			message: 'Data updated',
			updated_data: result.rows[0] || null,
			invoice: invoice
		})
	}catch (error){
		await client.query('ROLLBACK');
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}finally{
		client.release();
	}
});

// Delete Detail
app.delete('/invoice_detail/delete/:id', requireAuth, async(req,res)=>{
	const id = req.params.id;
	const client = await db.pool.connect();
	try{
		await client.query('BEGIN');
		const result = await client.query('DELETE FROM invoice_details WHERE id_detail = $1 RETURNING *', [id]);
		const invoice = result.rows[0] ? await recalcInvoiceTotal(client, result.rows[0].id_invoice) : null;
		await client.query('COMMIT');

		res.status(200).json({
			message: 'Delete successs',
			deleted_data: result.rows[0] || null,
			invoice: invoice
		});
	}catch(error){
		await client.query('ROLLBACK');
		console.error('Database error:', error);
		res.status(500).json({error: 'internal error'});
	}finally{
		client.release();
	}
});

// Login Handling
app.post('/login', async(req,res)=>{
	const { username, password } = req.body;
	const username_check = username == username_previllage;
	const password_check = await bcrypt.compare(password, password_previllage);
	const token = token_previllage;
	if (username_check && password_check){
		req.session.authenticated = true;
		return res.status(200).json({
			status: 200,
			message: 'Login Berhasil'
		});
	}
	return res.status(401).json({
		status: 401,
		message: 'Username atau Password Salah'
	})
});

// AuthHandling
function requireAuth(req, res, next) {
    if (!req.session.authenticated) {
		return res.redirect('/');
    }

    next();
}

function redirectIfAuth(req, res, next) {
    if (req.session.authenticated) {
        return res.redirect('/products');
    }

    next();
}

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});


