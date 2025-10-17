import { TournamentType } from '../../../shared/enums';
import { Button } from '../buttons/Button';
import { clearAllGameData } from '../utils/clearSessionStorage';
import { state } from '../utils/State';
import { leaveTournament } from '../utils/tournamentJoin';
import { Modal } from './Modal';

import { RemoteSetupModal } from './RemoteSetupModal';

export class RemoteGameModal extends Modal {
	private btn2plyr: Button;
	private btn2plyrPwr: Button;
	private btnTourn: Button;
	private btnTournPwr: Button;
	private keydownHandlers = new Map<
	HTMLElement,
	(e: KeyboardEvent) => void
	>();
	
	constructor(parent: HTMLElement) {
		super(parent);
		
		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;
		
		this.box.classList.add('remote-modal');

		const img2 = document.createElement('img');
		img2.src = '2p.png';
		img2.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const img2_pu = document.createElement('img');
		img2_pu.src = '2pPU.png';
		img2_pu.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const imgt = document.createElement('img');
		imgt.src = 'trophy.png';
		imgt.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const imgt_pu = document.createElement('img');
		imgt_pu.src = 'trophyPU.png';
		imgt_pu.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		this.btn2plyr = new Button(
			img2,
			() => this.logicRemote(2, TournamentType.Regular),
			this.box
		);
		this.btn2plyrPwr = new Button(
			img2_pu,
			() => this.logicRemote(2, TournamentType.Powerup),
			this.box
		);
		this.btnTourn = new Button(
			imgt,
			() => this.logicRemote(4, TournamentType.Regular),
			this.box
		);
		this.btnTournPwr = new Button(
			imgt_pu,
			() => this.logicRemote(4, TournamentType.Powerup),
			this.box
		);

		// Fixed button size with proper aspect ratio
		[
			this.btn2plyr,
			this.btn2plyrPwr,
			this.btnTourn,
			this.btnTournPwr,
		].forEach(btn => {
			btn.element.className +=
				' w-full' +
				' min-h-[40px] sm:min-h-[80px] md:min-h-[100px]' +
				' flex items-center justify-center' +
				' p-1 sm:p-2 md:p-3' +
				' hover:bg-[var(--color1bis)] transition-colors duration-300' +
				' focus:outline-none focus:ring-2 focus:ring-[var(--color1)]';
		});

		// Modal box background
		this.addEnterListener();
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');
		this.box.className +=
			' bg-[var(--color3)]' +
			' relative grid place-items-center' +
			' w-[160px] sm:w-auto max-w-[160px] sm:max-w-[400px] rounded-sm' +
			' grid-cols-1 sm:grid-cols-2';

		this.btn2plyr.element.focus();
		this.btn2plyr.element.tabIndex = 0;
		this.btn2plyrPwr.element.tabIndex = 0;
		this.btnTourn.element.tabIndex = 0;
		this.btnTournPwr.element.tabIndex = 0;

	}

	private addEnterListener() {
		const buttonConfigs = [
			{
				button: this.btn2plyr,
				player: 2,
				powerUp: TournamentType.Regular,
			},
			{
				button: this.btn2plyrPwr,
				player: 2,
				powerUp: TournamentType.Powerup,
			},
			{
				button: this.btnTourn,
				player: 4,
				powerUp: TournamentType.Regular,
			},
			{
				button: this.btnTournPwr,
				player: 4,
				powerUp: TournamentType.Powerup,
			},
		];

		buttonConfigs.forEach(({ button, player, powerUp }) => {
			const handler = (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.logicRemote(player, powerUp);
					return;
				}

				// Arrow key navigation
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
					e.preventDefault();
					const buttons = [
						this.btn2plyr,
						this.btn2plyrPwr,
						this.btnTourn,
						this.btnTournPwr,
					];
					const currentIndex = buttons.indexOf(button);
					const nextIndex = (currentIndex + 1) % buttons.length;
					buttons[nextIndex].element.focus();
					return;
				}

				if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
					e.preventDefault();
					const buttons = [
						this.btn2plyr,
						this.btn2plyrPwr,
						this.btnTourn,
						this.btnTournPwr,
					];
					const currentIndex = buttons.indexOf(button);
					const prevIndex =
						(currentIndex - 1 + buttons.length) % buttons.length;
					buttons[prevIndex].element.focus();
				}
			};
			// Store handler for cleanup
			this.keydownHandlers.set(button.element, handler);

			// Add event listener
			button.element.addEventListener('keydown', handler);
		});
	}

	private async logicRemote(tournamentSize: number, type: TournamentType) {
		leaveTournament();
		clearAllGameData();

		console.debug('Set sessionStorage');

		state.gameMode = 'remote';
		state.tournamentSize = tournamentSize;
		state.tournamentOngoing = tournamentSize === 4;

		sessionStorage.setItem('gameMode', 'remote');
		sessionStorage.setItem('playerCount', '2');
		sessionStorage.setItem('tournament', tournamentSize == 2 ? '0' : '1');
		sessionStorage.setItem(
			'tournamentType',
			type == TournamentType.Regular ? '0' : '1'
		);
		sessionStorage.setItem(
			'split',
			type == TournamentType.Regular ? '0' : '1'
		);
		sessionStorage.setItem(
			'stretch',
			type == TournamentType.Regular ? '0' : '1'
		);
		sessionStorage.setItem(
			'shrink',
			type == TournamentType.Regular ? '0' : '1'
		);

		new RemoteSetupModal(this.parent, type);
		this.destroy();
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		this.keydownHandlers.forEach((handler, element) => {
			element.removeEventListener('keydown', handler);
		});
		this.keydownHandlers.clear();

		this.btn2plyr?.destroy();
		this.btn2plyrPwr?.destroy();
		this.btnTourn?.destroy();
		this.btnTournPwr?.destroy();

		super.destroy();
	}
}
