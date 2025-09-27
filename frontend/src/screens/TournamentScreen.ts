import { ReadyButton } from '../buttons/ReadyButton';
import { state } from '../utils/State';
import { fetchAndUpdateTournamentMatchData } from '../utils/updateTurnMatchData';
import { Trophy } from '../visual/Trophy';
import { state } from '../utils/State';
import { fetchAndUpdateTournamentMatchData } from '../utils/updateTurnMatchData';
import { Trophy } from '../visual/Trophy';
import { Screen } from './Screen';

export class TournamentScreen extends Screen {
	private trophyInstance?: Trophy;
	private readyButton?: ReadyButton;

	// Handler for tournament updates
	private tournUpdHandler = async () => {
		await fetchAndUpdateTournamentMatchData();
		this.render();
	};

	private trophyInstance?: Trophy;
	private readyButton?: ReadyButton;

	// Handler for tournament updates
	private tournUpdHandler = async () => {
		await fetchAndUpdateTournamentMatchData();
		this.render();
	};

	constructor() {
		super();
		this.addStyles();
		document.addEventListener('tournament-updated', this.tournUpdHandler);
		this.initialize();
	}

	// ASYNC INIT RENDER (waits for data before rendering)
	private async initialize() {
		console.log('Initializing TournamentScreen...');
		await fetchAndUpdateTournamentMatchData();
		this.render();
		document.addEventListener('tournament-updated', this.tournUpdHandler);
		this.initialize();
	}

	// ASYNC INIT RENDER (waits for data before rendering)
	private async initialize() {
		console.log('Initializing TournamentScreen...');
		await fetchAndUpdateTournamentMatchData();
		this.render();
	}

	// HELPER
	// HELPER
	private createElement(
		parent: HTMLElement,
		tag: string,
		className: string
	): HTMLElement {
		const element = document.createElement(tag);
		element.className = className;
		parent.appendChild(element);
		return element;
		const element = document.createElement(tag);
		element.className = className;
		parent.appendChild(element);
		return element;
	}

	private addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.player-slot {
				background: var(--color1);
				color: var(--color3);
				transition: all 0.3s ease;
			}
			.player-slot.winner {
				background: var(--color2);
				color: var(--color3);
				box-shadow: 0 0 30px rgba(0, 255, 136, 0.8), 0 0 60px rgba(0, 255, 136, 0.4);
				transform: scale(1.05);
				border: 3px solid var(--color2);
				font-weight: bold;
				animation: winnerPulse 2s infinite;
			}
			@keyframes winnerPulse {
				0%, 100% { 
					box-shadow: 0 0 30px rgba(0, 255, 136, 0.8), 0 0 60px rgba(0, 255, 136, 0.4);
				}
				50% { 
					box-shadow: 0 0 40px rgba(0, 255, 136, 1), 0 0 80px rgba(0, 255, 136, 0.6);
				}
			}
			.bracket-line-horizontal { 
				height: 4px; 
				background-color: var(--color1); 
			}
			.bracket-line-vertical { 
				width: 4px; 
				background-color: var(--color1); 
			}
		`;
		document.head.appendChild(style);
	}

	private render() {
		this.element.innerHTML = '';

		this.element.className =
			'bg-transparent min-h-screen flex flex-col items-center justify-center p-8';

		// Title
		const title = this.createElement(
			this.element,
			'h1',
			'font-sigmar text-6xl text-center mb-12 text-[var(--color1)]'
		);
		title.textContent = 'TOURNAMENT';

		// Tournament bracket container - made wider for bigger slots
		const bracketGrid = this.createElement(
			this.element,
			'div',
			'bracket-grid grid grid-cols-7 gap-6 items-center max-w-7xl mx-auto mb-8'
		);
		this.renderBracket(bracketGrid);

		// Ready button - now this will work because init() has completed
		const matchID = sessionStorage.getItem('matchID');
		const winner = sessionStorage.getItem('winner');
		console.log('Checking for matchID at render time:', matchID);
		if (matchID && !winner) {
			console.log('Creating ReadyButton');
			this.readyButton = new ReadyButton(this.element);
		} else {
			console.log('No matchID found, ReadyButton not created');
		}
		// Ready button - now this will work because init() has completed
		const matchID = sessionStorage.getItem('matchID');
		const winner = sessionStorage.getItem('winner');
		console.log('Checking for matchID at render time:', matchID);
		if (matchID && !winner) {
			console.log('Creating ReadyButton');
			this.readyButton = new ReadyButton(this.element);
		} else {
			console.log('No matchID found, ReadyButton not created');
		}
	}

	private renderBracket(parent: HTMLElement) {
		const winner = sessionStorage.getItem('winner');
		const w1 = sessionStorage.getItem('w1') || 'Winner 1';
		const w2 = sessionStorage.getItem('w2') || 'Winner 2';
		const p1 = sessionStorage.getItem('p1') || 'Player 1';
		const p2 = sessionStorage.getItem('p2') || 'Player 2';
		const p3 = sessionStorage.getItem('p3') || 'Player 3';
		const p4 = sessionStorage.getItem('p4') || 'Player 4';

		const winner = sessionStorage.getItem('winner');
		const w1 = sessionStorage.getItem('w1') || 'Winner 1';
		const w2 = sessionStorage.getItem('w2') || 'Winner 2';
		const p1 = sessionStorage.getItem('p1') || 'Player 1';
		const p2 = sessionStorage.getItem('p2') || 'Player 2';
		const p3 = sessionStorage.getItem('p3') || 'Player 3';
		const p4 = sessionStorage.getItem('p4') || 'Player 4';

		// Left side players (match 0)
		const leftSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);
		const player1Slot = this.createPlayerSlot('player1', p1);
		const player2Slot = this.createPlayerSlot('player2', p2);

		// Highlight winners from first match
		if (w1 && w1 !== 'Winner 1') {
			if (p1 === w1) player1Slot.classList.add('winner');
			if (p2 === w1) player2Slot.classList.add('winner');
		}

		leftSide.appendChild(player1Slot);
		leftSide.appendChild(player2Slot);
		const player1Slot = this.createPlayerSlot('player1', p1);
		const player2Slot = this.createPlayerSlot('player2', p2);

		// Highlight winners from first match
		if (w1 && w1 !== 'Winner 1') {
			if (p1 === w1) player1Slot.classList.add('winner');
			if (p2 === w1) player2Slot.classList.add('winner');
		}

		leftSide.appendChild(player1Slot);
		leftSide.appendChild(player2Slot);

		// Left connector
		this.renderConnector(parent, 'left');

		// Semi winner 1
		const winner1Container = this.createElement(
			parent,
			'div',
			'col-span-1'
		);
		const winner1 = this.createPlayerSlot('winner1', w1 || 'Winner 1');
		winner1.classList.add('semi-winner');
		// Highlight if this winner has a real name (not placeholder)
		if (w1 && w1 !== 'Winner 1') {
			winner1.classList.add('winner');
		}
		winner1Container.appendChild(winner1);
		const winner1 = this.createPlayerSlot('winner1', w1 || 'Winner 1');
		winner1.classList.add('semi-winner');
		// Highlight if this winner has a real name (not placeholder)
		if (w1 && w1 !== 'Winner 1') {
			winner1.classList.add('winner');
		}
		winner1Container.appendChild(winner1);

		// Final match (empty column)
		this.createElement(parent, 'div', 'col-span-1');

		// Semi winner 2
		const winner2Container = this.createElement(
			parent,
			'div',
			'col-span-1'
		);
		const winner2 = this.createPlayerSlot('winner2', w2 || 'Winner 2');
		winner2.classList.add('semi-winner');
		// Highlight if this winner has a real name (not placeholder)
		if (w2 && w2 !== 'Winner 2') {
			winner2.classList.add('winner');
		}
		winner2Container.appendChild(winner2);
		const winner2 = this.createPlayerSlot('winner2', w2 || 'Winner 2');
		winner2.classList.add('semi-winner');
		// Highlight if this winner has a real name (not placeholder)
		if (w2 && w2 !== 'Winner 2') {
			winner2.classList.add('winner');
		}
		winner2Container.appendChild(winner2);

		// Right connector
		this.renderConnector(parent, 'right');

		// Right side players (match 1)
		const rightSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);
		const player3Slot = this.createPlayerSlot('player3', p3);
		const player4Slot = this.createPlayerSlot('player4', p4);

		// Highlight winners from second match
		if (w2 && w2 !== 'Winner 2') {
			if (p3 === w2) player3Slot.classList.add('winner');
			if (p4 === w2) player4Slot.classList.add('winner');
		}

		rightSide.appendChild(player3Slot);
		rightSide.appendChild(player4Slot);

		if (winner) {
			if (this.trophyInstance) this.trophyInstance.dispose();

			const trophyContainer = this.createElement(this.element, 'div', '');
			Object.assign(trophyContainer.style, {
				position: 'fixed',
				top: '0',
				left: '0',
				width: '100vw',
				height: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				pointerEvents: 'none', // ou 'auto' si tu veux capturer les clics
				zIndex: '9999',
			});
			this.trophyInstance = new Trophy(trophyContainer, { winner });
		}
		const player3Slot = this.createPlayerSlot('player3', p3);
		const player4Slot = this.createPlayerSlot('player4', p4);

		// Highlight winners from second match
		if (w2 && w2 !== 'Winner 2') {
			if (p3 === w2) player3Slot.classList.add('winner');
			if (p4 === w2) player4Slot.classList.add('winner');
		}

		rightSide.appendChild(player3Slot);
		rightSide.appendChild(player4Slot);

		if (winner) {
			if (this.trophyInstance) this.trophyInstance.dispose();

			const trophyContainer = this.createElement(this.element, 'div', '');
			Object.assign(trophyContainer.style, {
				position: 'fixed',
				top: '0',
				left: '0',
				width: '100vw',
				height: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				pointerEvents: 'none', // ou 'auto' si tu veux capturer les clics
				zIndex: '9999',
			});
			this.trophyInstance = new Trophy(trophyContainer, { winner });
		}
	}

	private renderConnector(parent: HTMLElement, side: 'left' | 'right') {
		const connector = this.createElement(
			parent,
			'div',
			'col-span-1 flex items-center justify-center h-full'
		);
		const lines = this.createElement(
			connector,
			'div',
			'relative w-full h-32'
		);

		if (side === 'left') {
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute top-8 left-0 w-3/4'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute bottom-8 left-0 w-3/4'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-vertical absolute left-3/4 top-8 h-16'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute top-1/2 -translate-y-1/2 left-3/4 w-8'
			);
		} else {
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute top-8 right-0 w-3/4'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute bottom-8 right-0 w-3/4'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-vertical absolute left-1/4 top-8 h-16'
			);
			this.createElement(
				lines,
				'div',
				'bracket-line-horizontal absolute top-1/2 -translate-y-1/2 right-3/4 w-8'
			);
		}
	}

	private createPlayerSlot(
		playerId: string,
		playerIdText: string
	): HTMLElement {
		const slot = document.createElement('div');
		slot.className =
			'player-slot rounded-lg px-6 py-4 text-center font-semibold text-xl ' +
			'min-h-[60px] min-w-[160px] flex items-center justify-center ' +
			'truncate max-w-[200px] border-2 border-transparent';
		slot.textContent = playerIdText;
		slot.setAttribute('data-player', playerId);
		slot.title = playerIdText; // Show full text on hover
		return slot;
	}

	// Override destroy to properly clean up Trophy resources + Readybutton
	public destroy() {
		console.log('Destroying TournamentScreen...');
		if (this.trophyInstance) {
			this.trophyInstance.dispose();
			this.trophyInstance = undefined;
		}
		if (this.readyButton) {
			this.readyButton.destroy();
			this.readyButton = undefined;
		}

		document.removeEventListener(
			'tournament-updated',
			this.tournUpdHandler
		);
		super.destroy();
	}

	// Override destroy to properly clean up Trophy resources + Readybutton
	public destroy() {
		console.log('Destroying TournamentScreen...');
		if (this.trophyInstance) {
			this.trophyInstance.dispose();
			this.trophyInstance = undefined;
		}
		if (this.readyButton) {
			this.readyButton.destroy();
			this.readyButton = undefined;
		}

		document.removeEventListener(
			'tournament-updated',
			this.tournUpdHandler
		);
		super.destroy();
	}
}
