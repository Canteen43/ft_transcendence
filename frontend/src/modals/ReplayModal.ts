import { hourglass, jelly, newtonsCradle } from 'ldrs';
import { z } from 'zod';
import { MESSAGE_REPLAY } from '../../../shared/constants';
import { Button } from '../buttons/Button';
import { GameScreen } from '../screens/GameScreen';
import { router } from '../utils/Router';
import { state } from '../utils/State';
import { replayTournament } from '../utils/tournamentJoin';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, eventListener for game Ready
export class ReplayModal extends Modal {
	private remoteReplayHandler = () => this.handleRemoteReplay();
	private timeoutId: ReturnType<typeof setTimeout> | null = null;
	private gameScreen?: GameScreen;
	
	constructor(
		parent: HTMLElement,
		gameMode: string,
		gameScreen?: GameScreen
	) {
		super(parent);
		
		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;

		if (gameScreen) this.gameScreen = gameScreen;
		this.overlay.className =
			'fixed inset-0 flex items-center justify-end flex-col pb-[25vh] bg-black/20 z-20 rounded-sm';

		this.box.classList.add('replay-modal');

		try {
			if (gameMode === 'local') {
				console.debug('replay local');
				const button = new Button(
					'Play again',
					() => {
						this.gameScreen!.reloadPong();
						this.destroy();
					},
					this.box
				);
			} else {
				console.debug('replay remote');
				const button = new Button(
					'Replay',
					() => this.replayClicked(),
					this.box
				);
				// Start 10 second timer- redirected to home after
				this.startTimer();
				// both players sent R -> activate RemoteReplay
				document.addEventListener(
					'RemoteReplay',
					this.remoteReplayHandler
				);
			}
		} catch (e: any) {
			console.error(e);
		}
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
		this.showLoader();
	}

	private startTimer() {
		this.timeoutId = setTimeout(() => {
			console.debug('Replay timer expired, returning to home');
			location.hash = '#home';
			this.destroy();
			setTimeout(() => {
				new TextModal(
					router.currentScreen!.element,
					undefined,
					'Replay timer expired'
				);
			}, 100);
		}, 10000);
	}

	private async handleRemoteReplay() {
		console.debug('Both players ready for replay, joining game...');

		// LOGIC for REPLAY TOURNAMENT
		const thisPlayer = sessionStorage.getItem('thisPlayer');
		if (thisPlayer == '1') {
			const player1 = sessionStorage.getItem('player1');
			const player2 = sessionStorage.getItem('player2');
			const result = await replayTournament({
				queue: [player1, player2],
			});
			if (!result.success) {
				this.showError(result.error, result.zodError);
				return;
			}
		}

		// Close the modal after successfully joining
		this.destroy();
	}

	private showLoader() {
		const button = this.box.querySelector('button');
		if (button) button.remove();

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
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		document.removeEventListener('RemoteReplay', this.remoteReplayHandler);
		super.destroy();
	}
}
