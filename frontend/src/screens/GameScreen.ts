import { MESSAGE_QUIT } from '../../../shared/constants';
import { Pong3D } from '../game/Pong3D';
import { TextModal } from '../modals/TextModal';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Screen } from './Screen';
import { clearAllGameData } from '../utils/clearSessionStorage';



export class GameScreen extends Screen {
	private pong3DInstance?: Pong3D;

	constructor() {
		super(true);

		// Game screen, remote game, no match ID -> redirect to home
		const matchID = sessionStorage.getItem('matchID');
		const gameMode = sessionStorage.getItem('gameMode');
		if (gameMode !== 'local' && !matchID) {
			new TextModal(
				this.element,
				'No match happening at the moment.',
				undefined,
				() => {
					location.hash = '#home';
				}
			);
			return;
		}

		// Initialize 3D pong
		this.pong3DInstance = new Pong3D(this.element, { gameScreen: this });
	}

	public reloadPong() {
		this.pong3DInstance?.dispose();
		this.pong3DInstance = new Pong3D(this.element, { gameScreen: this });
	}

	// Override destroy to properly clean up Pong3D resources
	public destroy(): void {
		if (this.pong3DInstance) {
			this.pong3DInstance.dispose();
		}
		this.pong3DInstance = undefined;
		const gameMode = sessionStorage.getItem('gameMode');
		const tournament = sessionStorage.getItem('tournament');
		if (state.gameOngoing && gameMode === 'remote') {
			console.debug('QUIT sent');
			webSocket.send({ t: MESSAGE_QUIT });
		}

		if (gameMode === 'remote' && tournament === '0') {
			clearAllGameData();
		}

		state.gameOngoing = false;

		super.destroy();
	}
}
