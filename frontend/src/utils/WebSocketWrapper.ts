import {
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	WS_ALREADY_CONNECTED,
	WS_AUTHENTICATION_FAILED,
	WS_TOKEN_EXPIRED,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { isLoggedIn } from '../buttons/AuthButton';
import { gameListener } from '../game/gameListener';
import { TextModal } from '../modals/TextModal';
import { wsURL } from './endpoints';
import { regListener } from './regListener';
import { router } from './Router';
import { leaveTournament } from '../utils/tournamentJoin';

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
	public shouldReconnect: boolean = false;
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private readonly RECONNECT_DELAY = 3000;

	constructor() {
		if (isLoggedIn()) {
			this.open();
		}
	}

	// Event handlers
	private onOpen(): void {
		console.info('WebSocket opened');
	}

	private onClose(event: CloseEvent): void {
		leaveTournament();
		console.info('WebSocket closed', {
			code: event.code,
			reason: event.reason,
		});
		this.ws = null;

		// Clear any existing reconnect timeout
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

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
		} else if (event.code === WS_ALREADY_CONNECTED) {
			console.warn('Already connected elsewhere');
			this.handleAuthFailure(
				'You are already logged in from another location.'
			);
			return;
		}

		// For other errors, trying to reopen after 3*i seconds if target state is 'open'
		if (this.shouldReconnect) {
			console.log(
				`Reconnecting in ${this.RECONNECT_DELAY / 1000} seconds...`
			);
			this.reconnectTimeoutId = setTimeout(() => {
				this.reconnectTimeoutId = null;
				this.open();
			}, this.RECONNECT_DELAY);
		}
	}

	private handleAuthFailure(message: string): void {
		this.shouldReconnect = false;

		sessionStorage.removeItem('token');
		sessionStorage.removeItem('userID');

		console.debug('Dispatching login-failed event');
		document.dispatchEvent(new CustomEvent('login-failed'));
		if (router.currentScreen?.element) {
			void new TextModal(router.currentScreen.element, message);
		} else {
			console.warn('Cannot show auth failure modal - no current screen');
		}
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
			this.shouldReconnect = false;
			return;
		}
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already open');
			return;
		}
		if (this.ws?.readyState === WebSocket.CONNECTING) {
			console.log('WebSocket already connecting');
			return;
		}

		console.info('Opening WebSocket');
		this.shouldReconnect = false;

		const wsUrlWithToken = `${wsURL}?token=${token}`;
		this.ws = new WebSocket(wsUrlWithToken);

		this.ws.addEventListener('open', () => this.onOpen());
		this.ws.addEventListener('close', event =>
			this.onClose(event as CloseEvent)
		);
		this.ws.addEventListener('message', event => this.onMessage(event));
		this.ws.addEventListener('error', error => this.onError(error));
	}

	public close(): void {
		console.log('Manually closing WebSocket');
		this.shouldReconnect = false;

		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		this.ws?.close(1000, 'Manual close');
		this.ws = null;
	}

	public send(message: Message): void {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			console.warn('Websocket not opened, message not sent.');
			return;
		}
		console.debug('Sending:', message);
		this.ws.send(JSON.stringify(message));
	}
}

export const webSocket = new WebSocketWrapper();
