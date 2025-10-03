import { hourglass, jelly, newtonsCradle } from 'ldrs';
import { z } from 'zod';
import { MESSAGE_REPLAY } from '../../../shared/constants';
import { Button } from '../buttons/Button';
import { clearMatchData } from '../utils/cleanSessionStorage';
import { router } from '../utils/Router';
import { state } from '../utils/State';
import {
	createTournament,
	joinTournament,
	leaveTournament,
} from '../utils/tournamentJoin';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, eventListener for game Ready
export class ReplayModal extends Modal {
	private remoteReplayHandler = () => this.handleRemoteReplay();
	private timeoutId: number | null = null;
	private wantreplay: boolean | null = false;

	constructor(parent: HTMLElement) {
		super(parent);
		const textElmt = document.createElement('p');
		textElmt.className = 'text-center text-lg text-[var(--color3)]';
		textElmt.textContent = 'Want to play again?';
		this.box.appendChild(textElmt);
		this.box.classList.add('replay-modal');

		new Button('Replay', () => this.replayClicked(), this.box);

		// Start 10 second timer- redirected to home after
		this.startTimer();

		// both players sent R -> activate RemoteReplay
		document.addEventListener('RemoteReplay', this.remoteReplayHandler);
	}

	// replay -> sends R
	private replayClicked() {
		const matchID = sessionStorage.getItem('matchID');
		if (!matchID) {
			new TextModal(this.box, 'No match ID found');
			console.error('No match ID found in session storage');
			return;
		}
		console.debug('Sending REPLAY and matchID: ' + matchID);
		webSocket.send({ t: MESSAGE_REPLAY, d: matchID });
		this.wantreplay = true;
		this.showLoader();
	}

	private startTimer() {
		this.timeoutId = window.setTimeout(() => {
			console.debug('Replay timer expired, returning to home');

			setTimeout(() => {
				const exitReplay = new TextModal(
					router.currentScreen!.element,
					undefined,
					'Replay timer expired'
				);
				exitReplay.onClose = () => {
					// if ((this.queuing = true)) {
					// 	leaveTournament();
					// 	this.queuing = false;
					// }
					location.hash = '#home';
				};
			}, 50);
			this.destroy();
		}, 10000);
	}

	private async handleRemoteReplay() {
		console.debug('Both players ready for replay, joining game...');

		this.wantreplay = false;
		// LOGIC for CREATE TOURNAMENT DIRECTLY
		const thisPlayer = sessionStorage.getItem('thisPlayer');
		if (thisPlayer == '1') {
			const player1 = sessionStorage.getItem('player1');
			const player2 = sessionStorage.getItem('player2');
			const result = await createTournament({
				queue: [player1, player2],
			});
			if (!result.success) {
				this.showError(result.error, result.zodError);
				return;
			}
		}

		// LOGIC for JOIN TOURNAMENT first
		// const thisPlayer = sessionStorage.getItem('thisPlayer');
		// const result = await joinTournament(2);
		// if (!result.success) {
		// 	this.showError(result.error, result.zodError);
		// 	return;
		// }

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
		if ((this.wantreplay = true)) {
			location.hash = '#home';
			clearMatchData();
		}

		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		document.removeEventListener('RemoteReplay', this.remoteReplayHandler);
		super.destroy();
	}
}
