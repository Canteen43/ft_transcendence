import './style.css';

const app = document.getElementById('app') as HTMLDivElement;

const spaRoot = document.createElement('div');
spaRoot.className =
  'flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 space-y-6';

app.appendChild(spaRoot);

const heading = document.createElement('h1');
heading.textContent = 'transcendence';
heading.className = 'text-6xl font-extrabold select-none font-ps2p';

const button = document.createElement('button');
button.textContent = 'Test GET-API';
button.className =
  'mt-8 px-6 py-3 bg-green-700 hover:bg-green-900 rounded-lg text-white font-semibold shadow-lg transition-colors';

button.addEventListener('click', async () => {
  try {
    // const res = await fetch('https://jsonplaceholder.typicode.com/users/1');
    const res = await fetch('https://1a7b7860-26ef-49a8-b367-439c7ea4ea05.mock.pstmn.io/users');
    const data = await res.json();
    // alert(`User: ${data.name}`);
	alert(JSON.stringify(data, null, 2)); // pretty-print JSON
  } catch (err) {
    alert('Error fetching data');
  }
});

spaRoot.appendChild(heading);
spaRoot.appendChild(button);
