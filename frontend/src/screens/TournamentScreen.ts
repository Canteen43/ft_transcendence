import { Screen } from '../components/Screen';
import { ReadyButton } from '../misc/ReadyButton';

interface Player {
	id: string;
	name: string;
}

export class TournamentScreen extends Screen {
	private playerAliass: { [key: string]: string };

	constructor(players?: Player[]) {
		super();

		const defaultPlayers = [
			{ id: 'player1', name: 'Player 1' },
			{ id: 'player2', name: 'Player 2' },
			{ id: 'player3', name: 'Player 3' },
			{ id: 'player4', name: 'Player 4' },
		];

		const actualPlayers = players || defaultPlayers;
		this.playerAliass = {};
		actualPlayers.forEach(player => {
			this.playerAliass[player.id] = player.name;
		});

		this.render();
		this.addStyles();
	}

	private createElement(
		parent: HTMLElement,
		tag: string,
		className: string
	): HTMLElement {
		const el = document.createElement(tag);
		el.className = className;
		parent.appendChild(el);
		return el;
	}

	private addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.player-slot {
				background: var(--color1);
				color: var(--color3);
			}
			.player-slot.winner {
				background: var(--color2);
				color: var(--color3);
				box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
			}
			.bracket-line-horizontal { height: 4px; background-color: var(--color1); }
			.bracket-line-vertical { width: 4px; background-color: var(--color1); }
		`;
		document.head.appendChild(style);
	}

	private render() {
		this.element.className =
			'bg-transparent min-h-screen flex flex-col items-center justify-center p-8';

		// Title
		const title = this.createElement(
			this.element,
			'h1',
			'font-sigmar text-6xl text-center mb-12 text-[var(--color1)]'
		);
		title.textContent = 'TOURNAMENT';

		// Tournament bracket container
		const bracketGrid = this.createElement(
			this.element,
			'div',
			'bracket-grid grid grid-cols-7 gap-4 items-center max-w-6xl mx-auto'
		);
		this.renderBracket(bracketGrid);

		// Start button
		const startButton = new ReadyButton(this.element);

		// 	startButton.addElement = 'button',
		// 	'mt-8 px-8 py-3 bg-[var(--color2)] text-[var(--color3)] font-semibold rounded-lg hover:bg-opacity-80 transition-all'
		// );
		// startButton.textContent = 'START';
	}

	private renderBracket(parent: HTMLElement) {
		// Left side players
		const leftSide = this.createElement(parent, 'div', 'col-span-1 space-y-8');
		leftSide.appendChild(this.createPlayerSlot('player1', this.playerAliass['player1']));
		leftSide.appendChild(this.createPlayerSlot('player2', this.playerAliass['player2']));

		// Left connector
		this.renderConnector(parent, 'left');

		// Semi winner 1
		const winner1Container = this.createElement(parent, 'div', 'col-span-1');
		const winner1 = this.createElement(
			winner1Container,
			'div',
			'player-slot rounded-lg px-4 py-3 text-center font-semibold text-lg opacity-50'
		);
		winner1.id = 'winner1';
		winner1.textContent = 'Winner 1';

		// Final match (empty column)
		this.createElement(parent, 'div', 'col-span-1');

		// Semi winner 2
		const winner2Container = this.createElement(parent, 'div', 'col-span-1');
		const winner2 = this.createElement(
			winner2Container,
			'div',
			'player-slot rounded-lg px-4 py-3 text-center font-semibold text-lg opacity-50'
		);
		winner2.id = 'winner2';
		winner2.textContent = 'Winner 2';

		// Right connector
		this.renderConnector(parent, 'right');

		// Right side players
		const rightSide = this.createElement(parent, 'div', 'col-span-1 space-y-8');
		rightSide.appendChild(this.createPlayerSlot('player3', this.playerAliass['player3']));
		rightSide.appendChild(this.createPlayerSlot('player4', this.playerAliass['player4']));
	}

	private renderConnector(parent: HTMLElement, side: 'left' | 'right') {
		const connector = this.createElement(parent, 'div', 'col-span-1 flex items-center justify-center h-full');
		const lines = this.createElement(connector, 'div', 'relative w-full h-32');

		if (side === 'left') {
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute top-8 left-0 w-3/4');
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute bottom-8 left-0 w-3/4');
			this.createElement(lines, 'div', 'bracket-line-vertical absolute left-3/4 top-8 h-16');
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute top-1/2 -translate-y-1/2 left-3/4 w-8');
		} else {
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute top-8 right-0 w-3/4');
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute bottom-8 right-0 w-3/4');
			this.createElement(lines, 'div', 'bracket-line-vertical absolute left-1/4 top-8 h-16');
			this.createElement(lines, 'div', 'bracket-line-horizontal absolute top-1/2 -translate-y-1/2 right-3/4 w-8');
		}
	}

	private createPlayerSlot(playerId: string, playerAlias: string): HTMLElement {
		const slot = document.createElement('div');
		slot.className = 'player-slot rounded-lg px-4 py-3 text-center font-semibold text-lg';
		slot.textContent = playerAlias;
		slot.setAttribute('data-player', playerId);
		return slot;
	}

	// Method to update player names
	updatePlayerName(playerId: string, name: string) {
		this.playerAliass[playerId] = name;
		const element = this.element.querySelector(`[data-player="${playerId}"]`) as HTMLElement;
		if (element) {
			element.textContent = name;
		}
	}

	// Method to set winner
	setWinner(playerId: string) {
		// Remove winner class from all
		this.element.querySelectorAll('.player-slot').forEach(slot => {
			slot.classList.remove('winner');
		});
		
		// Add winner class to selected player
		const winner = this.element.querySelector(`[data-player="${playerId}"]`);
		if (winner) {
			winner.classList.add('winner');
		}
	}
}