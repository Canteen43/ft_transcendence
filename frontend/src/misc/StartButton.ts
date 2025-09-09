import { Button } from '../components/Button';
import { state } from '../misc/state';

export class StartButton extends Button {
	constructor(parent: HTMLElement) {
		super('Start', () => this.onClick(), parent);
	}

	private onClick() {
		// mark state
		state.started_button_pressed = true;

		// remove all color classes (bg-*, hover:*)
		const classesToRemove = Array.from(this.element.classList).filter(c =>
			c.startsWith('bg-') || c.startsWith('hover:')
		);
		classesToRemove.forEach(c => this.element.classList.remove(c));

		// set grey background
		this.element.classList.add('bg-gray-500');

		// change label
		this.element.textContent = 'Started';
	}
}