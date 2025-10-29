// Examples for config.json:

// Use this for normal local development
// {
// 	"apiBase": "http://localhost:8080",
// 	"wsURL": "ws://localhost:8080/websocket"
// }

// Use this for testing multiplayer in development
// {
// 	"apiBase": "http://c3a6c2.42berlin.de:8080",
// 	"wsURL": "ws://c3a6c2.42berlin.de:8080/websocket"
// }

// This will be set at run-time when using a tunnel in production
// {
// 	"apiBase": "https://123.ngrok.io/api",
// 	"wsURL": "wss://123.ngrok.io/websocket"
// }

export let apiBase: string | null = null;
export let wsURL: string | null = null;

export async function getEndpoints() {
	const res = await fetch('/config.json', {
		cache: 'no-store',
	});
	if (!res.ok) {
		console.error(
			`Failed to load config.json: ${res.status} ${res.statusText}`
		);
		throw new Error(
			`Failed to load config.json: ${res.status} ${res.statusText}`
		);
	}
	const data = await res.json();
	apiBase = data.apiBase;
	wsURL = data.wsURL;
}
