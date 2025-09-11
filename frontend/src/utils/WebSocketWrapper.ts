import {
	MESSAGE_INITIATE_MATCH,
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';
import { gameListener } from '../game/gameListener';
// import { AliasModal } from '../modals/AliasModal';

export class WebSocketWrapper {
	private ws?: WebSocket;
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
		this.ws.addEventListener('close', () => {
			console.info('WebSocket connection closed');
		});
		this.ws.addEventListener('open', () => {
			console.info('WebSocket connection opened');
		});
	}

	close(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = undefined;
		}
	}

	private routeListener(event: MessageEvent): void {
		if (location.hash === '#game') {
			gameListener(event);
		} else {
			this.regListener(event);
		}
	}

	send(message: Message): void {
		if (!this.ws) {
			console.warn('Websocket not opened. Message not sent.');
			return;
		}
		this.ws.send(JSON.stringify(message));
	}

	public simulateMessage(msg: Message) {
		const event = new MessageEvent('message', {
			data: JSON.stringify(msg),
		});
		this.routeListener(event);
	}

	private regListener(event: MessageEvent): void {
		try {
			const raw =
				typeof event.data === 'string'
					? JSON.parse(event.data)
					: event.data;
			const msg: Message = MessageSchema.parse(raw);

			switch (msg.t) {
				case MESSAGE_INITIATE_MATCH:
					console.info('Received initiate match message:', msg);
					document.dispatchEvent(new Event('gameReady'));
					break;

				case MESSAGE_START_TOURNAMENT:
					console.info('Received start tournament message:', msg);
					// new AliasModalModal(parent);
					location.hash = '#tournament';
					break;

				case MESSAGE_START:
					console.info('Received start message:', msg);
					location.hash = '#game';
					break;

				default:
					console.warn('Unexpected websocket message received:', msg);
			}
		} catch (err) {
			console.error('Invalid message received:', event.data, err);
		}
	}
}

export const webSocket = new WebSocketWrapper(`ws://localhost:8080/websocket`);
// TODO: Avoid hardcoding port
// Access to environment variables is needed for that
