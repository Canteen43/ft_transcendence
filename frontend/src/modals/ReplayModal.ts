import { hourglass, jelly, newtonsCradle } from 'ldrs';
import { z } from 'zod';
import { MESSAGE_REPLAY } from '../../../shared/constants';
import { Button } from '../buttons/Button';
import { router } from '../utils/Router';
import { joinTournament } from '../utils/tournamentJoin';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, eventListener for game Ready
export class ReplayModal extends Modal {
	private remoteReplayHandler: () => void;
	private timeoutId: number | null = null;
	private isDestroyed = false;

	constructor(parent: HTMLElement) {
		super(parent);
		const textElmt = document.createElement('p');
		textElmt.className = 'text-center text-lg text-[var(--color3)]';
		textElmt.textContent = 'Want to play again?';
		this.box.appendChild(textElmt);
		this.box.classList.add('replay-modal');

		new Button('Replay', () => this.replayClicked(), this.box);

		this.remoteReplayHandler = () => this.handleRemoteReplay();
		document.addEventListener('RemoteReplay', this.remoteReplayHandler);

		// Start 10 second timer
		this.startTimer();
	}

	private startTimer() {
		this.timeoutId = window.setTimeout(() => {
			console.debug('Replay timer expired, returning to home');
			if (!this.isDestroyed) {
				location.hash = '#home';
				this.destroy();
				setTimeout(() => {
					new TextModal(router.currentScreen!.element, 'Your opponent got scared.');
				}, 50);
			}
		}, 10000);
	}

	private replayClicked() {
		const matchID = sessionStorage.getItem('matchID');
		if (!matchID) {
			new TextModal(this.box, 'No match ID found');
			console.error('No match ID found in session storage');
			return;
		}
		console.debug('Sending REPLAY and matchID: ' + matchID);
		webSocket.send({ t: MESSAGE_REPLAY, d: matchID });
		this.showLoader();
	}

	private async handleRemoteReplay() {
		console.debug('Both players ready for replay, joining game...');
		this.showLoader();

		const result = await joinTournament(2);
		if (!result.success) {
			this.showError(result.error, result.zodError);
			return;
		}
		// Close the modal after successfully joining
		this.destroy();
	}

	private showLoader() {
		// Clear the button content but keep button styling
		this.box.innerHTML = '';
		this.box.classList.remove('hover:bg-whatever');
		this.box.classList.add('cursor-not-allowed');
		this.box.style.backgroundColor = 'white';
		this.box.style.border = '2px solid white';
		// Add loader
		const container = document.createElement('div');
		container.className = 'flex items-center justify-center';
		const loader = document.createElement('l-hourglass');
		loader.setAttribute('size', '40');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');
		container.appendChild(loader);
		this.box.appendChild(container);
	}

	private showError(message: string, zodError?: z.ZodError): void {
		new TextModal(this.parent, message);
		if (zodError) {
			console.error('Validation failed:', z.treeifyError(zodError));
		}
		console.error(message);
		this.destroy();
	}

	public destroy(): void {
		this.isDestroyed = true;
		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		document.removeEventListener('RemoteReplay', this.remoteReplayHandler);
		super.destroy();
	}
}
