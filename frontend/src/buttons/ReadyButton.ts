import { MESSAGE_ACCEPT } from '../../../shared/constants';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';

export class ReadyButton extends Button {
	constructor(parent: HTMLElement) {
		super('Start', () => this.readyClicked(), parent);
	}

	private readyClicked() {
		const matchID = sessionStorage.getItem('matchID');
		if (!matchID) {
			console.error('No match ID found in session storage');
			return;
		}
		console.debug({ matchID });
		webSocket.send({ t: MESSAGE_ACCEPT, d: matchID });
		this.showLoader();
	}

	private showLoader() {
		// Clear the button content but keep button styling
		this.element.innerHTML = '';
		this.element.disabled = true;

		// Remove button styling - make it transparent
		this.element.classList.remove('hover:bg-whatever'); // Remove hover states
		this.element.classList.add('cursor-not-allowed');
		this.element.style.backgroundColor = 'transparent';
		this.element.style.border = 'none';

		// Add loader and text
		const container = document.createElement('div');
		container.className = 'flex items-center justify-center gap-2';

		const loader = document.createElement('l-hourglass');
		loader.setAttribute('size', '40'); 
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');

		const message = document.createElement('span');
		message.textContent = '';
		message.style.color = 'var(--color1)'; // Or whatever text color you prefer

		container.appendChild(loader);
		container.appendChild(message);
		this.element.appendChild(container);
	}
}
