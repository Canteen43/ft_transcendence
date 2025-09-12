import { MESSAGE_ACCEPT } from '../../../shared/constants';
import { Button } from '../components/Button';
import { webSocket } from '../utils/WebSocketWrapper';
import { MessageSchema } from '../../../shared/schemas/message';

export class StartButton extends Button {
	constructor(parent: HTMLElement) {
		super('Start', () => this.startClicked(), parent);
	}

// 	private startClicked() {
// 		const matchID = sessionStorage.getItem("matchId");
// 		const message = { t: MESSAGE_ACCEPT, d: matchID };
// 		const validatedMessage = MessageSchema.parse(message);
// 		webSocket.send(validatedMessage);
// 		// // remove all color classes (bg-*, hover:*)
// 		// const classesToRemove = Array.from(this.element.classList).filter(
// 		// 	c => c.startsWith('bg-') || c.startsWith('hover:')
// 		// );
// 		// classesToRemove.forEach(c => this.element.classList.remove(c));
// 		// // set grey background
// 		// this.element.classList.add('bg-gray-500');
// 		// // change label
// 		// this.element.textContent = 'Started';
// 	}
// }


	private startClicked() {
		const matchID = sessionStorage.getItem("matchID");
		if (!matchID) {
			console.error("No match ID found in session storage");
			alert("No match ID available");
			return;
		}
		
		const message = { t: MESSAGE_ACCEPT, d: matchID };
		const validatedMessage = MessageSchema.parse(message);
		webSocket.send(validatedMessage);
	}

}