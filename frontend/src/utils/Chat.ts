import { MESSAGE_CHAT } from '../../../shared/constants.js';
import { webSocket } from './WebSocketWrapper.js';

export class Chat {
	private container: HTMLElement;
	private messagesContainer: HTMLElement;
	private inputContainer: HTMLElement;
	private input: HTMLInputElement;

	constructor(parent: HTMLElement) {
		this.container = document.createElement('div');
		this.container.className =
			'fixed right-0 top-0 h-screen w-80 bg-white/90 backdrop-blur-sm ' +
			'shadow-lg flex flex-col z-40 border-l border-gray-300';

		// Messages container
		this.messagesContainer = document.createElement('div');
		this.messagesContainer.className =
			'flex-1 overflow-y-auto p-4 space-y-1 bg-gray-50';
		this.container.appendChild(this.messagesContainer);

		// Input container
		this.inputContainer = document.createElement('div');
		this.inputContainer.className = 'p-4 bg-white';

		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.placeholder = 'Type a message...';
		this.input.className =
			'w-full px-4 py-2 border border-gray-300 rounded-sm ' +
			'focus:outline-none focus:ring-2 focus:ring-[var(--color2)]';

		this.input.addEventListener('keypress', e => {
			if (e.key === 'Enter' && this.input.value.trim()) {
				this.sendMessage(this.input.value.trim());
				this.input.value = '';
			}
		});

		this.inputContainer.appendChild(this.input);
		this.container.appendChild(this.inputContainer);

		parent.appendChild(this.container);

		// Listen for incoming messages via document event
		document.addEventListener('chat-message', ((e: CustomEvent) => {
			this.receiveMessage(e.detail);
		}) as EventListener);
	}

	private receiveMessage(message: string): void {
		this.addMessageToUI(message);
	}

	private sendMessage(message: string): void {
		const username = sessionStorage.getItem('username') || 'Anonymous';
		const fullMessage = `${username}: ${message}`;

		// Send to server
		webSocket.send({
			t: MESSAGE_CHAT,
			d: fullMessage,
		});

		// Optimistically add to UI
		this.addMessageToUI(fullMessage);
	}

	private addMessageToUI(message: string): void {
		const messageEl = document.createElement('div');
		messageEl.className = 'px-2 py-1 bg-white rounded text-sm break-words';
		messageEl.textContent = message;

		this.messagesContainer.appendChild(messageEl);

		// Auto-scroll to bottom
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
	}

	public destroy(): void {
		this.container.remove();
	}
}