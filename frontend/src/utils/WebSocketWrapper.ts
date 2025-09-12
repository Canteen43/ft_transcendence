import {
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
		console.log('Sending WebSocket message:', {
			original: message,
			serialized: jsonMessage,
		});
		this.ws.send(JSON.stringify(message));
	}


	close(): void {
		if (this.ws) {
			this.ws.close();
			console.log('Closing WebSocket connection');
			this.ws = undefined;
		}
	}

	private routeListener(event: MessageEvent): void {
		if (location.hash === '#game') {
			console.log('Routing to game listener');
			gameListener(event);
		} else {
			console.log('Routing to registration listener');
			this.regListener(event);
		}
	}

	public simulateMessage(msg: Message) {
		console.log('Simulating WebSocket message:', msg);
		const event = new MessageEvent('message', {
			data: JSON.stringify(msg),
		});
		this.routeListener(event);
	}


	private regListener(event: MessageEvent): void {
		try {
			console.log('Processing message in regListener...');

			const raw =
				typeof event.data === 'string'
					? JSON.parse(event.data)
					: event.data;
			const msg: Message = MessageSchema.parse(raw);

			console.log('Validated message:', msg);
			console.log('Message type:', msg.t);

			switch (msg.t) {
				case MESSAGE_START_TOURNAMENT:
					console.info('Enough players joined:', msg);
					
					if (msg.d) {
						console.log('Storing tournament ID in session:', msg.d);
						sessionStorage.setItem('tournamentId', msg.d);
						document.dispatchEvent(new Event('gameReady'));
					} else {
						console.warn(
							'Tournament ID not found in message.d:',
							msg
						);
					}
					break;

				// case MESSAGE_START_TOURNAMENT:
				// 	console.info('Received start tournament message:', msg);
				// 	// new AliasModal(parent);
				// 	location.hash = '#game';
				// 	break;

				case MESSAGE_START:
					console.info('Received start message:', msg);
					document.dispatchEvent(new Event('toGameScreen'));
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
