import './style.css';

const app = document.getElementById('app') as HTMLDivElement;

const spaRoot = document.createElement('div');
spaRoot.className =
	'flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 space-y-6';

app.appendChild(spaRoot);

// Heading
const heading = document.createElement('h1');
heading.textContent = 'transcendence';
heading.className = 'text-6xl font-extrabold select-none font-ps2p';
spaRoot.appendChild(heading);

// Button container
const buttonContainer = document.createElement('div');
buttonContainer.className = 'flex space-x-4 justify-center';
spaRoot.appendChild(buttonContainer);

// Function to create buttons
function createButton(label: string, onClick: () => void) {
	const btn = document.createElement('button');
	btn.textContent = label;
	btn.className =
		'px-6 py-3 bg-green-700 hover:bg-green-900 rounded-lg text-white font-semibold shadow-lg transition-colors';
	btn.addEventListener('click', onClick);
	buttonContainer.appendChild(btn);
	return btn;
}

// Add first button
createButton('Mock API-Request', async () => {
	try {
		const res = await fetch(
			'https://1a7b7860-26ef-49a8-b367-439c7ea4ea05.mock.pstmn.io/users'
		);
		const data = await res.json();
		alert(JSON.stringify(data, null, 2));
	} catch {
		alert('Error fetching data');
	}
});

// Create a button to create a user
createButton('Create User', async () => {
	const newUser = {
		login: 'karl1234',
		first_name: 'Test',
		last_name: 'User',
		email: 'test.user@example.com',
		password_hash: 'supersecret',
	};

	try {
		const res = await fetch('http://localhost:8080/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newUser),
		});

		if (!res.ok) {
			const errText = await res.text(); // backend error message
			throw new Error(errText);
		}

		const data = await res.json();
		alert(JSON.stringify(data, null, 2));
	} catch (err) {
		alert('Error creating user: ' + err);
		console.error(err);
	}
});
