import {
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_PONG,
	WS_ALREADY_CONNECTED,
	WS_AUTHENTICATION_FAILED,
	WS_TOKEN_EXPIRED,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { isLoggedIn } from '../buttons/AuthButton';
import { gameListener } from '../game/gameListener';
import { TextModal } from '../modals/TextModal';
import { state } from '../utils/State';
import { leaveTournament } from '../utils/tournamentJoin';
import { clearRemoteData } from './clearSessionStorage';
import { wsURL } from './endpoints';
import { regListener } from './regListener';
import { router } from './Router';

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

// The BROWSER will automatically dispatch:
// - 'open' event when connection establishes
// - 'close' event when connection closes
// - 'message' event when server sends data
// - 'error' event when errors occur

class WebSocketWrapper {
	public ws: WebSocket | null = null;
	public shouldReconnect: boolean = false;
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private pingIntervalId: ReturnType<typeof setInterval> | null = null;
	private readonly PING_DELAY = 25000;
	private readonly RECONNECT_DELAY = 3000;
	private readonly MAX_RECONNECT_ATTEMPTS = 8; // total delay = 3*8=24s
	private reconnectAttempts = 0;
	private boundOnOpen = () => this.onOpen();
	private boundOnClose = (event: Event) => this.onClose(event as CloseEvent);
	private boundOnMessage = (event: MessageEvent) => this.onMessage(event);
	private boundOnError = (error: Event) => this.onError(error);

	constructor() {
		if (isLoggedIn()) {
			this.open();
		}
	}

	/////////////
	// Public methods

	public open(): void {
		const token = sessionStorage.getItem('token');
		if (!token) {
			console.warn('No token - cannot open WebSocket');
			this.shouldReconnect = false;
			return;
		}
		// when main imports the ws, the endpoints are not created yet - safeguard
		if (!wsURL) {
			console.warn('wsURL not loaded yet - cannot open WebSocket');
			this.shouldReconnect = false;
			return;
		}
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already open - returning');
			return;
		}
		if (this.ws?.readyState === WebSocket.CONNECTING) {
			console.log('WebSocket already connecting - returning');
			return;
		}

		if (this.ws) {
			this.removeListeners();
			this.ws.close(1000, 'Reopening');
			this.ws = null;
		}

		this.shouldReconnect = true;

		const wsUrlWithToken = `${wsURL}?token=${token}`;
		this.ws = new WebSocket(wsUrlWithToken);
		console.log(
			'WebSocket object created, readyState:',
			this.ws.readyState
		);

		this.ws.addEventListener('open', this.boundOnOpen);
		this.ws.addEventListener('close', this.boundOnClose);
		this.ws.addEventListener('message', this.boundOnMessage);
		this.ws.addEventListener('error', this.boundOnError);
	}

	public isOpen(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	public close(): void {
		this.shouldReconnect = false;

		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		this.removeListeners();
		console.log('Calling ws.close(1000)...');
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

	//////////
	// Private methods

	// Event handlers
	private onOpen(): void {
		console.info('WebSocket opened');
		this.reconnectAttempts = 0;

		// Wait briefly to ensure backend doesn't immediately reject the connection
		setTimeout(() => {
			// Only dispatch if connection is still open
			if (this.ws?.readyState === WebSocket.OPEN) {
				console.debug(
					'WebSocket.onOpen() - connection stable, dispatching ws-open'
				);
				document.dispatchEvent(new CustomEvent('ws-open'));
			} else {
				console.debug(
					'WebSocket.onOpen() - connection closed before stable, not dispatching ws-open'
				);
			}
		}, 100); // 100ms should be enough for backend to send rejection

		if (this.pingIntervalId) {
			clearInterval(this.pingIntervalId);
		}

		this.pingIntervalId = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ t: MESSAGE_PONG }));
				console.debug('PONG sent');
			}
		}, this.PING_DELAY);
	}

	private onClose(event: CloseEvent): void {
		console.debug('WebSocket.onClose() called', {
			code: event.code,
			reason: event.reason,
			shouldReconnect: this.shouldReconnect,
			reconnectAttempts: this.reconnectAttempts,
			maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
		});

		leaveTournament();
		this.removeListeners();
		this.ws = null;

		// Clear interval pings
		if (this.pingIntervalId) {
			clearInterval(this.pingIntervalId);
			this.pingIntervalId = null;
		}

		// Clear any existing reconnect timeout
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		// Events for frontend components
		console.debug('Dispatching ws-close event');
		document.dispatchEvent(
			new CustomEvent('ws-close', {
				detail: { code: event.code, reason: event.reason },
			})
		);

		// Handle auth failures - don't reconnect
		if (event.code === WS_AUTHENTICATION_FAILED) {
			console.warn(
				'Authentication failed: 4001 auth failed - dispatching login-failed'
			);
			this.handleAuthFailure(
				'Authentication failed. Please log in again.'
			);
			return;
		} else if (event.code === WS_TOKEN_EXPIRED) {
			console.warn(
				'Authentication failed: 4002 token expired - dispatching login-failed'
			);
			this.handleAuthFailure(
				'Your session has expired. Please log in again.'
			);
			return;
		} else if (event.code === WS_ALREADY_CONNECTED) {
			console.warn(
				'Already connected elsewhere - dispatching login-failed'
			);
			this.handleAuthFailure(
				'You are already logged in from another location.'
			);
			return;
		}

		// For other errors, trying to reopen after 3*i seconds if target state is 'open'
		if (
			this.shouldReconnect &&
			this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS
		) {
			this.reconnectAttempts++;
			console.log(
				`Reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${this.RECONNECT_DELAY / 1000} seconds...`
			);
			this.reconnectTimeoutId = setTimeout(() => {
				console.debug('Reconnect timeout fired, calling open()');
				this.reconnectTimeoutId = null;
				this.open();
			}, this.RECONNECT_DELAY);
		} else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error(
				'Max reconnect attempts reached. Giving up. Dispatching login-failed event.'
			);
			this.handleAuthFailure(
				'Unable to connect to server. Please refresh the page and log in again.'
			);
		} else {
			console.debug('Not reconnecting (shouldReconnect is false)');
		}
	}

	private handleAuthFailure(message: string): void {
		this.shouldReconnect = false;
		this.reconnectAttempts = 0;

		sessionStorage.removeItem('token');
		sessionStorage.removeItem('userID');
		sessionStorage.removeItem('username');
		const gameMode = sessionStorage.getItem('gameMode');

		if (location.hash === '#game' && gameMode === 'remote') {
			clearRemoteData();
			location.hash = '#home';
		}

		if (state.currentModal) {
			state.currentModal.destroy();
			state.currentModal = null;
		}

		document.dispatchEvent(new CustomEvent('login-failed'));

		if (router.currentScreen?.element) {
			void new TextModal(router.currentScreen.element, message);
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
		if (raw.t == MESSAGE_PONG) {
			console.info('MESSAGE_PONG received');
		} else {
			if (location.hash === '#game') {
				console.debug('Routing to in-game ws-handler.');
				gameListener(event);
			} else {
				console.debug('Routing to non-game ws-handler.');
				await regListener(event);
			}
		}
	}

	// always folllowed by onClose - no special action
	private onError(error: Event): void {
		console.error('WebSocket.onError():', error);
	}

	private removeListeners(): void {
		if (!this.ws) return;

		this.ws.removeEventListener('open', this.boundOnOpen);
		this.ws.removeEventListener('close', this.boundOnClose);
		this.ws.removeEventListener('message', this.boundOnMessage);
		this.ws.removeEventListener('error', this.boundOnError);
	}
}

export const webSocket = new WebSocketWrapper();
