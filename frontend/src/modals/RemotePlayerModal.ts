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


export class Remote3PlayerModal extends Modal {
	private Player1Field: HTMLInputElement;
	private Player2Field: HTMLInputElement;
	private Player3Field: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		this.Player1Field = this.myCreateInput('text', 'player1', 'Enter Player 1 ID');
		this.Player2Field = this.myCreateInput('text', 'player2', 'Enter Player 2 ID');
		this.Player3Field = this.myCreateInput('text', 'player3', 'Enter Player 3 ID');
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
		const player3 = this.Player3Field.value;

		try {
			const response = await fetch('http://localhost:8080/matches', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ player1, player2, player3}),
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



export class Remote4PlayerModal extends Modal {
	private Player1Field: HTMLInputElement;
	private Player2Field: HTMLInputElement;
	private Player3Field: HTMLInputElement;
	private Player4Field: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		this.Player1Field = this.myCreateInput('text', 'player1', 'Enter Player 1 ID');
		this.Player2Field = this.myCreateInput('text', 'player2', 'Enter Player 2 ID');
		this.Player3Field = this.myCreateInput('text', 'player3', 'Enter Player 3 ID');
		this.Player4Field = this.myCreateInput('text', 'player4', 'Enter Player 3 ID');
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
		const player3 = this.Player3Field.value;
		const player4 = this.Player4Field.value;

		try {
			const response = await fetch('http://localhost:8080/matches', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ player1, player2, player3, player4}),
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
