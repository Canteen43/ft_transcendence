import { Button } from '../buttons/Button';
import { GameScreen } from '../screens/GameScreen';
import { Modal } from './Modal';

export class NextRoundModal extends Modal {
	constructor(gameScreen: GameScreen, eliminatedAlias: string) {
		super(gameScreen.element);

		// Remove the overlay background and override positioning for replay modal
		this.overlay.className = this.overlay.className
			.replace('bg-black/50', 'bg-transparent')
			.replace('items-center', 'items-center mt-80');

		// Reduce padding and gap within the modal box
		this.box.className = this.box.className
			.replace('p-10', 'p-6')
			.replace('gap-4', 'gap-2');

		const message = document.createElement('p');
		message.className = 'text-2xl text-center text-black mb-2';
		const displayName = eliminatedAlias?.trim()
			? eliminatedAlias
			: 'A player';
		message.textContent = displayName;
		message.appendChild(document.createElement('br'));
		message.append('was eliminated!');
		this.box.appendChild(message);

		// Buttons container with reduced top margin
		const buttons = document.createElement('div');
		buttons.className = 'flex gap-4 mt-2';
		this.box.appendChild(buttons);

		// Play Again button
		new Button(
			'Next Round!',
			() => {
				gameScreen.reloadPong();
				this.destroy();
			},
			buttons
		);
	}
}
