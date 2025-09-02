export class WebSocketWrapper {
	private ws?: WebSocket;
	private address: string;

	constructor(address: string) {
		this.address = address;
	}

	open(): void {
		this.ws = new WebSocket(this.address);
	}

	addMessageListener(listener: (event: MessageEvent) => void): void {
		if (!this.ws) {
			console.warn("Websocket not open. Message listener not added.");
			return;
		}
		this.ws.addEventListener("message", listener);
	}

	send(message: string): void {
		if (!this.ws) {
			console.warn("Websocket not open. Message not sent.");
			return;
		}
		this.ws.send(message);
	}
}

// export const webSocket = new WebSocketWrapper("ws://localhost:8080");
export const webSocket = new WebSocketWrapper("wss://ws.ifelse.io");
