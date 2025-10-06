import {
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_CHAT,
	WS_ALREADY_CONNECTED,
	WS_AUTHENTICATION_FAILED,
	WS_CLOSE_POLICY_VIOLATION,
	WS_TOKEN_EXPIRED,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { isLoggedIn } from '../buttons/AuthButton';
import { gameListener } from '../game/gameListener';
import { TextModal } from '../modals/TextModal';
import { regListener } from './regListener';
import { router } from './Router';

const WS_ADDRESS = `ws://${import.meta.env.VITE_API_HOST}:${import.meta.env.VITE_API_PORT}/websocket`;

// INFO: A webSocket object opens automatically at creation.
// That's why a wrapper class is used. It can be created without opening the connection.

// this.ws?.close()           // Simple - browser uses code 1000 automatically
// this.ws?.close(1000)       // Explicit normal close code
// this.ws?.close(1000, 'reason')  // With reason string

// Constant			  Value		Meaning
// WebSocket.CONNECTING	0	Connection is being established
// WebSocket.OPEN		1	Connection is open and ready to use
// WebSocket.CLOSING	2	Connection is in the process of closing
// WebSocket.CLOSED		3	Connection is closed or couldn’t open

export class WebSocketWrapper {
	public ws: WebSocket | null = null;
	public targetState: 'open' | 'closed' | null = null;
	private reconnectModal?: TextModal | null;

	constructor() {
		if (isLoggedIn()) {
			this.open();
		}
	}

	// Event handlers
	private onOpen(): void {
		console.info('WebSocket opened');

		if (this.reconnectModal) {
			this.reconnectModal.destroy();
			this.reconnectModal = null;
		}
	}

	private onClose(event: CloseEvent): void {
		console.info('WebSocket closed', {
			code: event.code,
			reason: event.reason,
		});
		this.ws = null;

		// Handle auth failures - don't reconnect
		if (event.code === WS_AUTHENTICATION_FAILED) {
			console.warn('Authentication failed: 4001 auth failed');
			this.handleAuthFailure(
				'Authentication failed. Please log in again.'
			);
			return;
		} else if (event.code === WS_TOKEN_EXPIRED) {
			console.warn('Authentication failed: 4002 token expired');
			this.handleAuthFailure(
				'Your session has expired. Please log in again.'
			);
			return;
		}
		if (event.code === WS_ALREADY_CONNECTED) {
			console.warn('Already connected elsewhere');
			this.handleAuthFailure(
				'You are already logged in from another location.'
			);
			return;
		}

		// For other errors, trying to reopen after 3 seconds if target state is 'open'
		if (this.targetState === 'open') {
			console.log('Reconnecting in 3 seconds...');
			setTimeout(() => this.open(), 3000);

			if (!this.reconnectModal) {
				this.reconnectModal = new TextModal(
					router.currentScreen!.element,
					`${event.reason} Trying to reconnect...`,
					'Dismiss',
					() => {
						this.reconnectModal?.destroy();
						this.reconnectModal = null;
					}
				);
			}
		}
	}

	private handleAuthFailure(message: string): void {
		sessionStorage.removeItem('token');
		sessionStorage.removeItem('userID');
		console.debug('dispatching event login-failed');
		document.dispatchEvent(new CustomEvent('login-failed'));
		void new TextModal(router.currentScreen!.element, message);
	}

	private async onMessage(event: MessageEvent): Promise<void> {
		const raw =
			typeof event.data === 'string'
				? JSON.parse(event.data)
				: event.data;

		if (raw.t != MESSAGE_GAME_STATE && raw.t != MESSAGE_MOVE) {
			console.trace(location.hash, 'WS message received:', event.data);
		}
		if (location.hash === '#game') {
			console.debug('Routing to in-game ws-handler.');
			gameListener(event);
		} else {
			console.debug('Routing to non-game ws-handler.');
			await regListener(event);
		}
	}

	// always folllowed by onClose - no special action
	private onError(error: Event): void {
		console.error('WebSocket error:', error);
	}

	// Public methods
	public open(): void {
		// Checking token A) because WS needs it, B) to avoid login attempts when logged out
		const token = sessionStorage.getItem('token');
		if (!token) {
			console.warn('No token - cannot open WebSocket');
			return;
		}

		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already open');
			return;
		}

		console.info('Opening WebSocket');
		const wsUrl = `${WS_ADDRESS}?token=${token}`;
		this.targetState = 'open';
		this.ws = new WebSocket(wsUrl);

		this.ws.addEventListener('open', () => this.onOpen());
		this.ws.addEventListener('close', event =>
			this.onClose(event as CloseEvent)
		);
		this.ws.addEventListener('message', event => this.onMessage(event));
		this.ws.addEventListener('error', error => this.onError(error));
	}

	public close(): void {
		console.log('Manually closing WebSocket');
		this.targetState = 'closed';
		this.ws?.close(1000, 'Manual close');
	}

	public send(message: Message): void {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			console.warn('Websocket not opened, message not sent.');
			return;
		}
		console.debug('Sending:', message);
		this.ws.send(JSON.stringify(message));
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
