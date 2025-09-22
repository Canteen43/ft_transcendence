import { Button } from '../buttons/Button';
import { GameScreen } from '../screens/GameScreen';
import { Modal } from './Modal';

export class ReplayModal extends Modal {
	constructor(gameScreen: GameScreen) {
		super(gameScreen.element);

		// Override positioning to center horizontally and position just below vertical center
		this.overlay.className = this.overlay.className.replace(
			'items-center',
			'items-start pt-50'
		);


		// Buttons container
		const buttons = document.createElement('div');
		buttons.className = 'flex gap-4 mt-4';
		this.box.appendChild(buttons);

		// Play Again button
		new Button(
			'Play Again',
			() => {
				gameScreen.reloadPong();
				this.destroy();
			},
			buttons
		);

	}
}
