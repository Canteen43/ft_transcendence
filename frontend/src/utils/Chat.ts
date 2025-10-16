import { MESSAGE_CHAT } from '../../../shared/constants.js';
import { isConnected, isLoggedIn } from '../buttons/AuthButton';
import { state } from './State.js';
import { webSocket } from './WebSocketWrapper.js';

export class ChatManager {
	private chat: Chat | null = null;
	private parent: HTMLElement;
	private bndInitChat = () => this.initChat();
	private bndDestroyChat = () => this.destroyChat();

	constructor(parent: HTMLElement) {
		this.parent = parent;

		// Listen for login state changes
		document.addEventListener('login-success ws-open', this.bndInitChat);
		document.addEventListener('login-failed', this.bndDestroyChat);
		document.addEventListener('logout-success', this.bndDestroyChat);

		// Initialize on load if already logged in
		if (isLoggedIn()) {
			this.initChat();
		}
	}

	private initChat() {
		if (!isLoggedIn() || !this.parent) return;
		console.debug('Initializing chat');
		if (!this.chat) {
			this.chat = new Chat(this.parent);
		}
	}

	private destroyChat() {
		console.debug('Destroy Chat banner called');
		if (this.chat) {
			this.chat.destroy();
			this.chat = null;
		}
	}

	destroy() {
		this.destroyChat();
		document.removeEventListener('login-success ws-open', this.bndInitChat);
		document.removeEventListener('login-failed', this.bndDestroyChat);
		document.removeEventListener('logout-success', this.bndDestroyChat);
	}
}

export class Chat {
	private container: HTMLElement;
	private messagesContainer: HTMLElement;
	private input: HTMLInputElement;
	private toggleButton: HTMLButtonElement;
	private isExpanded: boolean = true;
	private username: string;
	private connected: boolean = isConnected();

	constructor(parent: HTMLElement) {
		this.username = sessionStorage.getItem('username') || 'Anonymous';
		this.isExpanded = state.chatExpanded ?? true;
		state.chatExpanded = this.isExpanded;

		// main container - no background, just a positioning wrapper
		this.container = document.createElement('div');
		this.container.className =
			'fixed right-0 bottom-8 flex flex-col z-20';

		// Messages container (hides when collapsed)
		this.messagesContainer = document.createElement('div');
		this.messagesContainer.className =
			'w-80 h-[calc(100vh-5rem)] overflow-y-auto p-2 space-y-1 bg-white/10 ' +
			'backdrop-blur-sm shadow-lg transition-all duration-300';
		this.container.appendChild(this.messagesContainer);

		// Input container (always visible, fixed at bottom)
		const inputContainer = document.createElement('div');
		inputContainer.className =
			'w-80 p-2 h-12 flex gap-2 bg-white/10 backdrop-blur-sm shadow-lg ';

		// Input
		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.placeholder = 'Type a message...';
		this.input.className =
			'flex-1 px-4 py-2 border border-gray-300 bg-[var(--color1)] rounded-sm ' +
			'focus:outline-none focus:ring-2 focus:ring-grey text-[var(--color3)] text-sm';
		this.input.addEventListener('keypress', this.handleKeypress);
		this.input.focus();

		// Toggle button
		this.toggleButton = document.createElement('button');
		this.toggleButton.className =
			'px-4 py-2 bg-[var(--color1)] text-[var(--color3)] rounded-sm ' +
			'hover:bg-[var(--color5)] transition-colors focus:outline-none';
		this.toggleButton.textContent = '▼'; // Down arrow when expanded
		this.toggleButton.addEventListener('click', this.handleToggle);

		// input and toggle in inputContainer
		inputContainer.appendChild(this.input);
		inputContainer.appendChild(this.toggleButton);

		// inputContainer in Main container
		this.container.appendChild(inputContainer);

		// attached to parent
		parent.appendChild(this.container);

		// Listen for incoming messages via document event
		document.addEventListener('chat-message', this.handleIncomingMessage);
		// Listen for incoming messages via document event
		document.addEventListener('keydown', this.handleGlobalKeydown);
	}

	private handleKeypress = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && this.input.value.trim()) {
			this.sendMessage(this.input.value.trim());
			this.input.value = '';
		}
	};

	private handleToggle = () => {
		this.isExpanded = !this.isExpanded;
		state.chatExpanded = this.isExpanded;
		console.debug('Dispatching CHAT TOGGLED');
		console.debug('this.isExpanded ' + this.isExpanded);
		console.debug('state.chatExpanded' + this.isExpanded);

		document.dispatchEvent(new CustomEvent('chat-toggled'));

		if (this.isExpanded) {
			// Show messages
			this.input.focus();
			this.messagesContainer.style.display = 'block';
			this.toggleButton.textContent = '▼';
		} else {
			// Hide messages
			this.messagesContainer.style.display = 'none';
			this.toggleButton.textContent = '▲';
		}
	};

	private handleGlobalKeydown = (e: Event) => {
		const ke = e as KeyboardEvent;
		if (ke.code === 'Space' && document.activeElement !== this.input) {
			ke.preventDefault();
			this.handleToggle();
		}
	};

	private handleIncomingMessage = (e: Event) => {
		this.addMessage((e as CustomEvent).detail);
	};

	private addMessage(message: string): void {
		const messageElmt = document.createElement('div');
		messageElmt.className =
			'px-1 py-1 rounded-md text-sm text-white bg-gray-400/30 max-w-full break-words';
		messageElmt.textContent = message;

		this.messagesContainer.appendChild(messageElmt);
		// Auto-scroll to bottom
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
	}

	private sendMessage(message: string): void {
		const fullMessage = `${this.username}: ${message}`;
		// Send to server
		webSocket.send({ t: MESSAGE_CHAT, d: fullMessage });
		// add to message board
		this.addMessage(fullMessage);
	}

	public destroy(): void {
		document.removeEventListener(
			'chat-message',
			this.handleIncomingMessage
		);
		document.removeEventListener('keydown', this.handleGlobalKeydown);
		this.input.removeEventListener('keypress', this.handleKeypress);
		this.toggleButton.removeEventListener('click', this.handleToggle);
		this.container.remove();
	}
}
