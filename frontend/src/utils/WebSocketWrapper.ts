import {
	MESSAGE_ACCEPT,
	MESSAGE_DECLINE,
	MESSAGE_GAME_STATE,
	MESSAGE_INITIATE_MATCH,
	MESSAGE_INITIATE_TOURNAMENT,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';
import { gameListener } from '../game/gameListener';

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
		this.address += `?token=${token}`;
		this.ws = new WebSocket(this.address);
		this.ws.addEventListener('message', event => this.routeListener(event));
		// This is for debugging
		this.ws.addEventListener('close', () => {
			alert('WebSocket connection closed');
		});
	}

	close(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = undefined;
			alert('Websocket connection closed by client');
		}
	}

	private routeListener(event: MessageEvent): void {
		if (location.hash === '#game') {
			gameListener(event);
		} else {
			this.regListener(event);
		}
	}

	send(message: string): void {
		if (!this.ws) {
			console.warn('Websocket not opened. Message not sent.');
			return;
		}
		this.ws.send(message);
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
				case MESSAGE_INITIATE_TOURNAMENT:
					alert('Initiate Tournament: ' + JSON.stringify(msg));
					break;

				case MESSAGE_INITIATE_MATCH:
					alert('Initiate Match: ' + JSON.stringify(msg));
					break;

				case MESSAGE_START_TOURNAMENT:
					alert('Start Tournament: ' + JSON.stringify(msg));
					break;

				case MESSAGE_ACCEPT:
					alert('Accept: ' + JSON.stringify(msg));
					break;

				case MESSAGE_DECLINE:
					alert('Decline: ' + JSON.stringify(msg));
					break;

				case MESSAGE_START:
					alert('Start: ' + JSON.stringify(msg));
					break;

				case MESSAGE_PAUSE:
					alert('Pause: ' + JSON.stringify(msg));
					break;

				case MESSAGE_QUIT:
					alert('Quit: ' + JSON.stringify(msg));
					break;

				case MESSAGE_MOVE:
					alert('Move: ' + JSON.stringify(msg));
					break;

				case MESSAGE_GAME_STATE:
					alert('Game State: ' + JSON.stringify(msg));
					break;

				case MESSAGE_POINT:
					alert('Point: ' + JSON.stringify(msg));
					break;

				default:
					console.warn('Unknown message type:', msg);
			}
		} catch (err) {
			console.error('Invalid message received:', event.data, err);
		}
	}
}

export const webSocket = new WebSocketWrapper(`ws://localhost:8080/websocket`);
// TODO: Avoid hardcoding port
// Access to environment variables is needed for that
