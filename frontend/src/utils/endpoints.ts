export let apiBase: string | null = null;
export let wsURL: string | null = null;

// Example config.json files:
// {
// 	"mode": "local",
// 	"host": "localhost",
// 	"port": 8080,
// 	"tunnelURL": ""
// }
// {
// 	"mode": "local",
// 	"host": "c3a6c2.42berlin.de",
// 	"port": 8080,
// 	"tunnelURL": ""
// }
// {
// 	"mode": "tunnel",
// 	"host": "",
// 	"port": 0,
// 	"tunnelURL": "123.ngrok.io"
// }

export async function getEndpoints() {
	const res = await fetch('/config.json');
	if (!res.ok) {
		console.error(
			`Failed to load config.json: ${res.status} ${res.statusText}`
		);
		throw new Error(
			`Failed to load config.json: ${res.status} ${res.statusText}`
		);
	}
	const data = await res.json();
	if (data.mode === 'local') {
		apiBase = `http://${data.host}:${data.port}`;
		wsURL = `ws://${data.host}:${data.port}/websocket`;
	} else if (data.mode === 'tunnel') {
		apiBase = `https://${data.tunnelURL}/api`;
		wsURL = `wss://${data.tunnelURL}/websocket`;
	} else {
		console.error(`Unknown mode in config.json: ${data.mode}`);
		throw new Error(`Unknown mode in config.json: ${data.mode}`);
	}
}
