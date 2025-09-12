import { MESSAGE_ACCEPT } from '../../../shared/constants';
import { Button } from '../components/Button';
import { webSocket } from '../utils/WebSocketWrapper';

export class ReadyButton extends Button {
	constructor(parent: HTMLElement) {
		super('Start', () => this.readyClicked(), parent);
	}

	private readyClicked() {
		const matchID = sessionStorage.getItem("matchID");
		if (!matchID) {
			console.error("No match ID found in session storage");
			return;
		}
		webSocket.send({ t: MESSAGE_ACCEPT, d: matchID });
		this.destroy();
	}
}