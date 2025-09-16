import type { Message } from '../../../shared/schemas/message';
import { gameListener } from '../game/gameListener';
import { regListener } from './regListener';

// import { AliasModal } from '../modals/AliasModal';

export class WebSocketWrapper {
	public ws?: WebSocket;
	private address: string;

	constructor(address: string) {
		this.address = address;
	}

	open(): void {
		let token = sessionStorage.getItem('token');
		if (!token) {
			console.error('No token found');
			return;
		}
		const wsUrl = `${this.address}?token=${token}`;
		this.ws = new WebSocket(wsUrl);

		this.ws.addEventListener('message', event => this.routeListener(event));

		// TODO: add the logic for reconnection
		this.ws.addEventListener('close', () => {
			console.info('WebSocket connection closed');
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
			console.log('Closing WebSocket connection');
			this.ws = undefined;
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
