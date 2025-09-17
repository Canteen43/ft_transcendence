import type { Message } from '../../../shared/schemas/message';
import { gameListener } from '../game/gameListener';
import { regListener } from './regListener';

// import { AliasModal } from '../modals/AliasModal';

export class WebSocketWrapper {
	public ws: WebSocket | null = null;
	private address: string;

	constructor(address: string) {
		this.address = address;
		if (sessionStorage.getItem('token')) {
			this.open();
		}
	}

	open(): void {
		let token = sessionStorage.getItem('token');
		if (!token) {
			console.error("Couldn't open WS. No token found");
			return;
		}
		const wsUrl = `${this.address}?token=${token}`;
		this.ws = new WebSocket(wsUrl);

		this.ws.addEventListener('message', event => this.routeListener(event));

		this.ws.addEventListener('close', () => {
			console.info('WebSocket connection closed.');
			if (sessionStorage.getItem('token')) {
				console.info('Reconnecting WebSocket...');
				this.open();
			}
		});

		this.ws.addEventListener('open', () => {
			console.info('WebSocket connection opened successfully');
		});

		this.ws.addEventListener('error', error => {
			console.error('WebSocket error:', error);
		});
	}

	send(message: Message): void {
		if (!this.ws) {
			console.warn('Websocket not opened. Message not sent.');
			return;
		}
		const jsonMessage = JSON.stringify(message);
		console.info('Sending WebSocket message:', {
			original: message,
			serialized: jsonMessage,
		});
		this.ws.send(jsonMessage);
	}

	close(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private async routeListener(event: MessageEvent): Promise<void> {
		if (location.hash === '#game') {
			console.log('Routing to game listener');
			gameListener(event);
		} else {
			console.log('Routing to registration listener');
			await regListener(event);
		}
	}

	public simulateMessage(msg: Message) {
		console.log('Simulating WebSocket message:', msg);
		const event = new MessageEvent('message', {
			data: JSON.stringify(msg),
		});
		this.routeListener(event);
	}
}

export const webSocket = new WebSocketWrapper(`ws://localhost:8080/websocket`);
// TODO: Avoid hardcoding port
// Access to environment variables is needed for that
