import { MESSAGE_QUIT } from '../../../shared/constants';
import { Pong3D } from '../game/Pong3D';
import { TextModal } from '../modals/TextModal';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Screen } from './Screen';

export class GameScreen extends Screen {
	private pong3DInstance?: Pong3D;

	constructor() {
		super();

		// Game screen, remote game, no match ID -> redirect to home
		const matchID = sessionStorage.getItem('matchID');
		const gameMode = sessionStorage.getItem('gameMode');
		if (gameMode == 'remote' && !matchID) {
			new TextModal(
				this.element,
				'No remote game happening at the moment.',
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
	public destroy() {
		if (this.pong3DInstance) {
			this.pong3DInstance.dispose();
		}
		if (state.gameOngoing && state.gameMode === 'remote') {
			webSocket.send({ t: MESSAGE_QUIT });
		}
		state.gameOngoing = false;
		state.gameMode = null;
		// Call parent destroy to remove DOM element
		super.destroy();
	}
}
