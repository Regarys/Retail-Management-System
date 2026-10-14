const el = {
	loginForm: document.getElementById('loginForm'),
	username: document.getElementById('username'),
	password: document.getElementById('password'),
	submitBtn: document.getElementById('submitBtn'),
	togglePassword: document.getElementById('togglePassword')
}

async function login(event){
	event.preventDefault();
	const formData = new FormData(el.loginForm);
	const username = formData.get('username').toString();
	const password = formData.get('password').toString();

	const data = {
		username: username,
		password: password
	}

	try{
		const result = await fetch('/login', {
			method: 'POST',
			headers: {
				'Content-Type' : 'application/json'
			},
			body: JSON.stringify(data) 
		});
		const response = await result.json();
		if (response.status === 200){
			window.location.href = "products";
			const message = response.message;
			console.log(response);
			console.log(message);
		}else if(response.status === 401){
			const message = response.message;
			console.log(message);
		}
	}catch(err){
		console.error(err.message);
	}
}

function passwordToggle(){
	const isHidden = el.password.type === 'password';

	el.password.type = isHidden ? 'text' : 'password';

	el.togglePassword.classList.toggle('is-visible', isHidden);

	el.togglePassword.setAttribute(
		'aria-label',
		isHidden ? 'Sembunyikan password' : 'Tampilkan password'
	);

	el.togglePassword.setAttribute('aria-pressed', String(isHidden));
}

el.loginForm.addEventListener('submit', login);
el.togglePassword.addEventListener('click', passwordToggle);
