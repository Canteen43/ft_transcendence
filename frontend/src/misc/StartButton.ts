import { MESSAGE_ACCEPT } from '../../../shared/constants';
import { Button } from '../components/Button';
import { webSocket } from '../utils/WebSocketWrapper';

export class StartButton extends Button {
	constructor(parent: HTMLElement) {
		super('Start', () => this.startClicked(), parent);
	}

	private startClicked() {

		webSocket.send({ t: MESSAGE_ACCEPT });
		location.hash = '#game';


		// // remove all color classes (bg-*, hover:*)
		// const classesToRemove = Array.from(this.element.classList).filter(
		// 	c => c.startsWith('bg-') || c.startsWith('hover:')
		// );
		// classesToRemove.forEach(c => this.element.classList.remove(c));
		// // set grey background
		// this.element.classList.add('bg-gray-500');
		// // change label
		// this.element.textContent = 'Started';
	}
}
