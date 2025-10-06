import { MESSAGE_CHAT } from '../../../shared/constants.js';
import { state } from './State.js';
import { webSocket } from './WebSocketWrapper.js';

export class Chat {
	private container: HTMLElement;
	private messagesContainer: HTMLElement;
	private input: HTMLInputElement;
	private toggleButton: HTMLButtonElement;
	private isExpanded: boolean = true;

	constructor(parent: HTMLElement) {
		this.isExpanded = state.chatExpanded ?? true;
		state.chatExpanded = this.isExpanded;

		// main container - no background, just a positioning wrapper
		this.container = document.createElement('div');
		this.container.className =
			'fixed right-0 bottom-[2.5rem] flex flex-col z-40';

		// Messages container (hides when collapsed)
		this.messagesContainer = document.createElement('div');
		this.messagesContainer.className =
			'w-80 h-[calc(100vh-7.5rem)] overflow-y-auto p-2 space-y-1 bg-white/10 ' +
			'backdrop-blur-sm shadow-lg transition-all duration-300';
		this.container.appendChild(this.messagesContainer);

		// Input container (always visible, fixed at bottom)
		const inputContainer = document.createElement('div');
		inputContainer.className =
			'w-80 p-4 flex gap-2 bg-white/10 backdrop-blur-sm shadow-lg ';

		// Input
		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.placeholder = 'Type a message...';
		this.input.className =
			'flex-1 px-4 py-2 border border-gray-300 bg-[var(--color1)] rounded-sm ' +
			'focus:outline-none focus:ring-2 focus:ring-grey text-[var(--color3)] text-sm';
		this.input.addEventListener('keypress', this.handleKeypress);

		// Toggle button
		this.toggleButton = document.createElement('button');
		this.toggleButton.className =
			'px-3 py-2 bg-[var(--color1)] text-[var(--color3)] rounded-sm ' +
			'hover:bg-[var(--color5)] transition-colors focus:outline-none';
		this.toggleButton.innerHTML = '▼'; // Down arrow when expanded
		this.toggleButton.addEventListener('click', this.handleToggle);

		// input and toggle in inputContainer
		inputContainer.appendChild(this.input);
		inputContainer.appendChild(this.toggleButton);

		// inputContainer in Main container
		this.container.appendChild(inputContainer);

		// attached to main or parent
		const main = document.querySelector('main');
		if (main) {
			main.appendChild(this.container);
		} else {
			// Fallback to parent if main doesn't exist
			parent.appendChild(this.container);
		}

		// Listen for incoming messages via document event
		document.addEventListener('chat-message', this.handleChatMessage);
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

		document.dispatchEvent(new CustomEvent('chat-toggled'));

		if (this.isExpanded) {
			// Show messages
			this.messagesContainer.style.display = 'block';
			this.toggleButton.innerHTML = '▼'; // Down arrow
		} else {
			// Hide messages
			this.messagesContainer.style.display = 'none';
			this.toggleButton.innerHTML = '▲'; // Up arrow
		}
	};

	private handleChatMessage = (e: Event) => {
		this.receiveMessage((e as CustomEvent).detail);
	};

	private receiveMessage(message: string): void {
		const messageEl = document.createElement('div');
		messageEl.className =
			'px-1 py-1 rounded-md text-sm text-white bg-gray-400/30 max-w-full break-words';
		messageEl.textContent = message;

		this.messagesContainer.appendChild(messageEl);
		// Auto-scroll to bottom
		this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
	}

	private sendMessage(message: string): void {
		const username = sessionStorage.getItem('username') || 'Anonymous';
		const fullMessage = `${username}: ${message}`;

		// Send to server
		webSocket.send({ t: MESSAGE_CHAT, d: fullMessage });
		// add to message board
		this.receiveMessage(fullMessage);
	}

	public destroy(): void {
		// Remove all event listeners
		document.removeEventListener('chat-message', this.handleChatMessage);
		this.input.removeEventListener('keypress', this.handleKeypress);
		this.toggleButton.removeEventListener('click', this.handleToggle);

		// Remove from DOM
		this.container.remove();
	}
}
