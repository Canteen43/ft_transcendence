import { FullTournamentSchema } from '../../../shared/schemas/tournament.js';
import { ReadyButton } from '../buttons/ReadyButton';
import { TextModal } from '../modals/TextModal';
import { apiCall } from '../utils/apiCall';
import { clearRemoteData, clearTournData } from '../utils/clearSessionStorage';
import { updateTournData } from '../utils/updateTurnMatchData.js';
import { Trophy } from '../visual/Trophy';
import { Screen } from './Screen';

export class TournamentScreen extends Screen {
	private readyButton?: ReadyButton;
	private trophyInstance?: Trophy;
	private tournamentUpdateHandler = () => void this.tournamentUpdate();

	constructor() {
		super(true);
		clearRemoteData();
		clearTournData();
		this.background();
		document.addEventListener(
			'tournament-updated',
			this.tournamentUpdateHandler
		);
		this.initialize();
	}

	private background(): void {
		this.element.style.backgroundImage = 'url(tournBG.png)';
		this.element.classList.add(
			'bg-cover',
			'bg-center',
			'bg-no-repeat',
			'bg-fixed',
			'relative',
			'overflow-hidden'
		);

		const overlay = document.createElement('div');
		overlay.className = 'absolute inset-0 bg-black/40 -z-10';

		this.element.appendChild(overlay);
	}

	// ASYNC INIT RENDER (waits for data before rendering)
	private async initialize(): Promise<void> {
		try {
			await this.tournamentUpdate();
		} catch (err) {
			console.error('Initialization failed:', err);
			this.errorModal('Failed to initialize tournament screen.');
		}
	}

	private errorModal(message: string): void {
		const modal = new TextModal(this.element, message, undefined);
		modal.onClose = () => {
			location.hash = '#home';
		};
	}

	private async tournamentUpdate(): Promise<void> {
		const tournID = sessionStorage.getItem('tournamentID');
		if (!tournID) {
			console.error('No tournament ID found in session storage');
			this.errorModal('No tournament found');
			return;
		}

		console.debug('Calling tournament details API');
		const { data: tournData, error } = await apiCall(
			'GET',
			`/tournaments/${tournID}`,
			FullTournamentSchema
		);

		if (error) {
			console.error('Tournament fetch error:', error);
			const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
			this.errorModal(message);
			return;
		}

		if (!tournData) {
			console.error('Getting tournament data failed - no data returned');
			this.errorModal('Failed to get tournament data');
			return;
		}

		console.log('Tournament data received:', tournData);
		updateTournData(tournData);
		this.render(); // Render after data is updated
	}

	private render() {
		this.element.textContent = '';
		this.element.className =
			'bg-transparent min-h-screen flex flex-col items-center justify-center p-8';
		this.renderTitle();
		// Tournament bracket container
		const bracketGrid = this.createElement(
			this.element,
			'div',
			'bracket-grid grid grid-cols-7 gap-6 items-center max-w-7xl mx-auto mb-8'
		);
		this.renderBracket(bracketGrid);
		this.renderReadyButton();
		this.renderTrophy();
	}

	private renderBracket(parent: HTMLElement) {
		const winner = sessionStorage.getItem('winner');
		const w1 = sessionStorage.getItem('w1') || 'Winner 1';
		const w2 = sessionStorage.getItem('w2') || 'Winner 2';
		const p1 = sessionStorage.getItem('p1') || 'Player 1';
		const p2 = sessionStorage.getItem('p2') || 'Player 2';
		const p3 = sessionStorage.getItem('p3') || 'Player 3';
		const p4 = sessionStorage.getItem('p4') || 'Player 4';

		// Get scores
		const p1Score = sessionStorage.getItem('p1Score') || '-1';
		const p2Score = sessionStorage.getItem('p2Score') || '-1';
		const p3Score = sessionStorage.getItem('p3Score') || '-1';
		const p4Score = sessionStorage.getItem('p4Score') || '-1';
		const w1Score = sessionStorage.getItem('w1Score') || '-1';
		const w2Score = sessionStorage.getItem('w2Score') || '-1';

		// Left side players (match 0)
		const leftSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);

		// Show scores if we have a winner from first match
		const showMatch0Scores = w1 && w1 !== 'Winner 1';
		const player1Slot = this.createPlayerSlot(
			p1,
			w1 === p1 ? 'winner' : showMatch0Scores ? 'loser' : 'normal',
			showMatch0Scores ? p1Score : undefined
		);
		const player2Slot = this.createPlayerSlot(
			p2,
			w1 === p2 ? 'winner' : showMatch0Scores ? 'loser' : 'normal',
			showMatch0Scores ? p2Score : undefined
		);

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
		const showFinalScores = winner && winner !== '';
		const winner1Status = showFinalScores
			? winner === w1
				? 'winner'
				: 'loser'
			: 'normal';
		const winner1 = this.createPlayerSlot(
			w1 || 'Winner 1',
			winner1Status,
			showFinalScores && w1 !== 'Winner 1' ? w1Score : undefined
		);
		winner1.classList.add('semi-winner');
		winner1Container.appendChild(winner1);

		// Final match (empty column)
		this.createElement(parent, 'div', 'col-span-1');

		// Semi winner 2
		const winner2Container = this.createElement(
			parent,
			'div',
			'col-span-1'
		);
		const winner2Status = showFinalScores
			? winner === w2
				? 'winner'
				: 'loser'
			: 'normal';
		const winner2 = this.createPlayerSlot(
			w2 || 'Winner 2',
			winner2Status,
			showFinalScores && w2 !== 'Winner 2' ? w2Score : undefined
		);
		winner2.classList.add('semi-winner');
		winner2Container.appendChild(winner2);

		// Right connector
		this.renderConnector(parent, 'right');

		// Right side players (match 1)
		const rightSide = this.createElement(
			parent,
			'div',
			'col-span-1 space-y-8'
		);

		// Show scores if we have a winner from second match
		const showMatch1Scores = w2 && w2 !== 'Winner 2';
		const player3Slot = this.createPlayerSlot(
			p3,
			w2 === p3 ? 'winner' : showMatch1Scores ? 'loser' : 'normal',
			showMatch1Scores ? p3Score : undefined
		);
		const player4Slot = this.createPlayerSlot(
			p4,
			w2 === p4 ? 'winner' : showMatch1Scores ? 'loser' : 'normal',
			showMatch1Scores ? p4Score : undefined
		);

		rightSide.appendChild(player3Slot);
		rightSide.appendChild(player4Slot);
	}

	private renderConnector(parent: HTMLElement, side: 'left' | 'right') {
		const connector = this.createElement(
			parent,
			'div',
			'col-span-1 flex items-center justify-center'
		);

		const line = this.createElement(
			connector,
			'div',
			`w-full h-0.5 bg-[var(--color1)] ${side === 'left' ? 'ml-4' : 'mr-4'}`
		);
	}

	private renderTitle() {
		const title = this.createElement(
			this.element,
			'h1',
			"font-outfit [font-variation-settings:'wght'_900] text-6xl text-center mb-12 text-[var(--color1)]"
		);
		title.textContent = 'TOURNAMENT';
	}
	private createPlayerSlot(
		name: string,
		status: 'winner' | 'loser' | 'normal',
		score?: string
	): HTMLElement {
		const slot = document.createElement('div');

		// Apply status class
		let statusClass = '';
		if (status === 'winner') {
			statusClass = 'winner';
		} else if (status === 'loser') {
			statusClass = 'loser';
		}

		slot.className = `player-slot px-6 py-4 text-center font-semibold text-xl min-h-[60px] min-w-[160px] flex items-center justify-center truncate max-w-[200px] border-2 border-transparent ${statusClass}`;

		if (score !== undefined && score !== '-1') {
			slot.textContent = `${name} - ${score}`;
		} else {
			slot.textContent = name;
		}

		return slot;
	}

	private renderReadyButton() {
		const matchID = sessionStorage.getItem('matchID');
		const winner = sessionStorage.getItem('winner');

		// Check if there's an active match
		const hasActiveMatch = matchID && !winner;

		if (hasActiveMatch && !this.readyButton) {
			console.log('Creating ReadyButton');
			this.readyButton = new ReadyButton(this.element);
		} else if (this.readyButton && !hasActiveMatch) {
			// Clean up ready button if no longer needed
			this.readyButton.destroy();
			this.readyButton = undefined;
		}
	}

	private renderTrophy() {
		const winner = sessionStorage.getItem('winner');
		if (winner && !this.trophyInstance) {
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
				pointerEvents: 'none',
				zIndex: '9999',
			});
			this.trophyInstance = new Trophy(trophyContainer, { winner });
		}
	}

	private createElement(
		parent: HTMLElement,
		tag: string,
		className: string
	): HTMLElement {
		const element = document.createElement(tag);
		element.className = className;
		parent.appendChild(element);
		return element;
	}

	public destroy(): void {
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
			this.tournamentUpdateHandler
		);

		super.destroy();
	}
}
