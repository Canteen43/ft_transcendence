import { Screen } from '../components/Screen';
import { Button } from '../components/Button';


interface Player {
	id: string;
	name: string;
}

interface TournamentMatch {
	winner: string | null;
	players: string[];
}

interface TournamentState {
	semi1: TournamentMatch;
	semi2: TournamentMatch;
	final: TournamentMatch;
}

export class TournamentScreen extends Screen {
	private tournamentState: TournamentState;
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

		this.tournamentState = {
			semi1: { winner: null, players: ['player1', 'player2'] },
			semi2: { winner: null, players: ['player3', 'player4'] },
			final: { winner: null, players: [] },
		};

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
        background:var(--color4);
        border: 2px solid var(--color1);
        transition: all 0.3s ease;
        color: var(--color1);
      }
      .player-slot.winner {
        background: var(--color5);
        color: white;
        box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
      }
      .bracket-line-horizontal {height: 2px; background-color: var(--color1);}
      .bracket-line-vertical {width: 2px; background-color: var(--color1);}
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
        50% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.8); }
      }
      .champion { animation: glow 2s infinite; }
    `;
		document.head.appendChild(style);
	}

	private render() {
		this.element.className =
			'bg-transparent min-h-screen flex items-center justify-center p-8';

		const container = this.createElement(
			this.element,
			'div',
			'tournament-container'
		);

		const title = this.createElement(
			container,
			'h1',
			'font-rubik text-6xl font-bold text-center mb-12 text-[var(--color1)]'
		);
		title.textContent = 'TOURNAMENT';

		const bracketGrid = this.createElement(
			container,
			'div',
			'bracket-grid grid grid-cols-7 gap-4 items-center max-w-6xl mx-auto'
		);

		this.renderLeftSide(bracketGrid);
		this.renderLeftConnector(bracketGrid);
		this.renderSemiWinner1(bracketGrid);
		this.renderFinalMatch(bracketGrid);
		this.renderSemiWinner2(bracketGrid);
		this.renderRightConnector(bracketGrid);
		this.renderRightSide(bracketGrid);

		this.renderControls(container);
	}

	private renderLeftSide(parent: HTMLElement) {
		const leftSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);

		const player1 = this.createPlayerSlot(
			'player1',
			this.playerAliass['player1']
		);
		leftSide.appendChild(player1);

		const player2 = this.createPlayerSlot(
			'player2',
			this.playerAliass['player2']
		);
		leftSide.appendChild(player2);
	}

	private renderLeftConnector(parent: HTMLElement) {
		const connector = this.createElement(
			parent,
			'div',
			'col-span-1 flex items-center justify-center h-full'
		);
		const bracketConnector = this.createElement(
			connector,
			'div',
			'bracket-connector w-full h-full flex items-center justify-center'
		);
		const lines = this.createElement(
			bracketConnector,
			'div',
			'relative w-full h-32'
		);

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
			'absolute left-3/4 -translate-x-3/4 bracket-line-vertical absolute right-7 top-8 h-16'
		);
		this.createElement(
			lines,
			'div',
			'bracket-line-horizontal absolute top-1/2 -translate-y- left-3/4 w-8'
		);
	}

	private renderSemiWinner1(parent: HTMLElement) {
		const winner1Container = this.createElement(
			parent,
			'div',
			'col-span-1'
		);
		const winner1 = this.createElement(
			winner1Container,
			'div',
			'player-slot rounded-lg px-2 py-2 text-center font-semibold text-lg opacity-50'
		);
		winner1.id = 'winner1';
		winner1.textContent = 'Winner 1';
	}

	private renderFinalMatch(parent: HTMLElement) {
		this.createElement(
			parent,
			'div',
			'col-span-1 flex flex-col items-center space-y-4'
		);
	}

	private renderSemiWinner2(parent: HTMLElement) {
		const winner2Container = this.createElement(
			parent,
			'div',
			'col-span-1'
		);
		const winner2 = this.createElement(
			winner2Container,
			'div',
			'player-slot rounded-lg px-4 py-3 text-center font-semibold text-lg opacity-50'
		);
		winner2.id = 'winner2';
		winner2.textContent = 'Winner 2';
	}

	private renderRightConnector(parent: HTMLElement) {
		const connector = this.createElement(
			parent,
			'div',
			'col-span-1 flex flex-col items-center justify-center h-full'
		);
		const bracketConnector = this.createElement(
			connector,
			'div',
			'bracket-connector w-full h-full flex items-center justify-center'
		);
		const lines = this.createElement(
			bracketConnector,
			'div',
			'relative w-full h-32'
		);

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

	private renderRightSide(parent: HTMLElement) {
		const rightSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);

		const player3 = this.createPlayerSlot(
			'player3',
			this.playerAliass['player3']
		);
		rightSide.appendChild(player3);

		const player4 = this.createPlayerSlot(
			'player4',
			this.playerAliass['player4']
		);
		rightSide.appendChild(player4);
	}

	private renderControls(parent: HTMLElement) {
		const controlsContainer = this.createElement(parent,'div','flex justify-center gap-4 mt-12');
	}

	private createPlayerSlot(
		playerId: string,
		playerAlias: string
	): HTMLElement {
		const slot = document.createElement('div');
		slot.className = 'player-slot rounded-lg px-3 py-3 text-center font-semibold text-lg';
		slot.textContent = playerAlias;
		slot.setAttribute('data-player', playerId);
		return slot;
	}



}
