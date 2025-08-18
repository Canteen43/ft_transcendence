const spaRoot = document.createElement('div');
spaRoot.className =
	'flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 space-y-6';

// Heading
const heading = document.createElement('h1');
heading.textContent = 'transcendence';
heading.className = 'text-6xl font-extrabold select-none font-ps2p';
spaRoot.appendChild(heading);

// Button container
const buttonContainer = document.createElement('div');
buttonContainer.className = 'flex space-x-4 justify-center';
spaRoot.appendChild(buttonContainer);

// Function to create and append a button without creating a named object
function createButton(label: string, onClick: () => void) {
	const button = new Button(label, onClick);
	buttonContainer.appendChild(button.element);
}

// Add first button
createButton('Postman Mock-Request', async () => {
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
createButton('Create Test User', async () => {
	const timestamp = Date.now();
	const newUser = {
		login: `test_${timestamp}`,
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

// Actual Buttons
createButton('Local 1v1', async () => {
	alert('Sorry. Not yet implemented.');
});
createButton('Local 1vAI', async () => {
	alert('Sorry. Not yet implemented.');
});
createButton('Remote 1v1', async () => {
	alert('Sorry. Not yet implemented.');
});
createButton('Tournament', async () => {
	alert('Sorry. Not yet implemented.');
});