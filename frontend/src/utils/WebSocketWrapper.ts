import type { Message } from '../../../shared/schemas/message';
import { gameListener } from '../game/gameListener';
import { regListener } from './regListener';

const WS_ADDRESS = `ws://${import.meta.env.VITE_API_HOST}:${import.meta.env.VITE_API_PORT}/websocket`;

// INFO: A webSocket object opens automatically at creation.
// That's why a wrapper class is used. It can be created without opening the connection.

export class WebSocketWrapper {
	public ws: WebSocket | null = null;
	public targetState: 'open' | 'closed' | null = null;

	constructor() {
		if (sessionStorage.getItem('token')) {
			this.open();
		}
	}

	// Event handlers
	private onOpen(): void {
		console.info('WebSocket connection opened successfully.');
	}

	private onClose(): void {
		console.info('WebSocket connection closed.');
		this.ws = null;
		// Trying to reopen after 3 seconds if target state is 'open'
		if (this.targetState === 'open') {
			setTimeout(() => this.open(), 3000);
		}
	}

	private async onMessage(event: MessageEvent): Promise<void> {
		console.debug('WebSocket message received:', event.data);
		if (location.hash === '#game') {
			console.debug('Routing to in-game ws-handler.');
			gameListener(event);
		} else {
			console.debug('Routing to non-game ws-handler.');
			await regListener(event);
		}
	}

	private onError(error: Event): void {
		console.error('WebSocket error:', error);
	}

	// Public methods
	public open(): void {
		// Checking token A) because WS needs it, B) to avoid login attempts when logged out
		let token = sessionStorage.getItem('token');
		if (!token) {
			console.warn("Couldn't open WS. No token found");
			return;
		}
		const wsUrl = `${WS_ADDRESS}?token=${token}`;

		this.targetState = 'open';

		console.info('Trying to open WebSocket');
		this.ws = new WebSocket(wsUrl);

		this.ws.addEventListener('open', () => this.onOpen());
		this.ws.addEventListener('close', () => this.onClose());
		this.ws.addEventListener('message', event => this.onMessage(event));
		this.ws.addEventListener('error', error => this.onError(error));
	}

	public close(): void {
		this.targetState = 'closed';
		this.ws?.close();
	}

	public send(message: Message): void {
		if (!this.ws) {
			console.warn('Websocket not opened. Message not sent.');
			return;
		}
		const jsonMessage = JSON.stringify(message);
		console.debug('Sending WebSocket message:', {
			original: message,
			serialized: jsonMessage,
		});
		this.ws.send(jsonMessage);
	}

	public simulateMessage(msg: Message) {
		console.log('Simulating WebSocket message:', msg);
		const event = new MessageEvent('message', {
			data: JSON.stringify(msg),
		});
		this.onMessage(event);
	}
}

export const webSocket = new WebSocketWrapper();
