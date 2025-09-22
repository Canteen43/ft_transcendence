import { Trophy } from '../game/Trophy';
import { Screen } from './Screen';

export class TrophyScreen extends Screen {
	private trophyInstance: Trophy;

	constructor() {
		super();
		// Get winner from session data, default to "Player1"
		const winner = sessionStorage.getItem('winner') || 'Player1';
		// Initialize 3D trophy display
		this.trophyInstance = new Trophy(this.element, { winner });
	}

	public reloadTrophy() {
		const winner = sessionStorage.getItem('winner') || 'Player1';
		this.trophyInstance.dispose();
		this.trophyInstance = new Trophy(this.element, { winner });
	}

	// Override destroy to properly clean up Trophy resources
	public destroy() {
		if (this.trophyInstance) {
			this.trophyInstance.dispose();
		}
		// Call parent destroy to remove DOM element
		super.destroy();
	}
}
