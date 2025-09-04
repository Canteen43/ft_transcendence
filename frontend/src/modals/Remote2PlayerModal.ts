import { Modal } from '../components/Modal';
import { Button } from '../components/Button';

export class Remote2PlayerModal extends Modal {
	private Player1Field: HTMLInputElement;
	private Player2Field: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		this.Player1Field = this.myCreateInput('text', 'player1', 'Enter Player 1 ID');
		this.Player2Field = this.myCreateInput('text', 'player2', 'Enter Player 2 ID');
		new Button('Start Match', () => this.handleStartMatch(), this.box);
	}

	// helpers
	private myCreateInput(type: string, id: string, placeholder: string): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		input.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(input);
		return input;
	}

	private async handleStartMatch() {
		const player1 = this.Player1Field.value;
		const player2 = this.Player2Field.value;

		try {
			const response = await fetch('http://localhost:8080/matches', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ player1, player2 }),
			});

			if (response.ok) {
				const matchData = await response.json();
				console.log('Match started successfully:', matchData);
				this.destroy();
			} else {
				console.error('Failed to start match');
			}
		} catch (error) {
			console.error('Error starting match:', error);
		}
	}
}