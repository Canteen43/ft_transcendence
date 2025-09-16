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
		console.debug({matchID});
		webSocket.send({ t: MESSAGE_ACCEPT, d: matchID });
		this.showLoader();
	}

	private showLoader() {
		// Clear the button content but keep button styling
		this.element.innerHTML = '';
		this.element.disabled = true;

		// Keep button visible but indicate disabled state
		this.element.classList.remove('hover:bg-whatever'); // Remove hover states
		this.element.classList.add('cursor-not-allowed');

		// Make sure button background is visible
		this.element.style.backgroundColor = 'var(--color1)'; // or whatever your button color is
		this.element.style.color = 'white';
		this.element.style.border = '1px solid var(--color1)';

		// Add loader and text
		const container = document.createElement('div');
		container.className = 'flex items-center justify-center gap-2';

		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '24'); // Smaller to fit in button
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'white'); // White to show on button background

		const message = document.createElement('span');
		message.textContent = '';
		message.style.color = 'white';

		container.appendChild(loader);
		container.appendChild(message);
		this.element.appendChild(container);
	}
}
