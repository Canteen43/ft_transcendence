import { Button } from '../buttons/Button';
import { GameScreen } from '../screens/GameScreen';
import { Modal } from './Modal';

export class ReplayModal extends Modal {
	constructor(gameScreen: GameScreen) {
		super(gameScreen.element);

		// Text
		const message = document.createElement('p');
		message.textContent = 'Do you want to play again?';
		message.className = 'text-xl font-semibold text-center mb-4';
		this.box.appendChild(message);

		// Buttons container
		const buttons = document.createElement('div');
		buttons.className = 'flex gap-6 mt-4';
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

		// Leave button
		new Button(
			'Leave',
			() => {
				location.hash = '#home';
				this.destroy();
			},
			buttons
		);
	}
}
