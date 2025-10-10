import { TournamentType } from '../../../shared/enums';
import { Button } from '../buttons/Button';
import {
	clearMatchData,
	clearOtherGameData,
	clearTournData,
} from '../utils/cleanSessionStorage';
import { state } from '../utils/State';
import { AliasModal } from './AliasModal';
import { Modal } from './Modal';

export class RemoteGameModal extends Modal {
	private btn2plyr: Button;
	private btn2plyrPwr: Button;
	private btnTourn: Button;
	private btnTournPwr: Button;

	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add('remote-modal');

		const img2 = document.createElement('img');
		img2.src = '2_players.png';
		img2.className = 'h-16 sm:h-20 md:h-[100px]';

		const img2_pu = document.createElement('img');
		img2_pu.src = '2_players_powerups.png';
		img2_pu.className = 'h-16 sm:h-20 md:h-[100px]';

		const imgt = document.createElement('img');
		imgt.src = 'trophy.png';
		imgt.className = 'h-16 sm:h-20 md:h-[100px]';

		const imgt_pu = document.createElement('img');
		imgt_pu.src = 'trophy_powerups.png';
		imgt_pu.className = 'h-16 sm:h-20 md:h-[100px]';

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

		// fixed button size
		[
			this.btn2plyr,
			this.btn2plyrPwr,
			this.btnTourn,
			this.btnTournPwr,
		].forEach(btn => {
			btn.element.className +=
				' w-full max-w-[300px] sm:max-w-[350px] md:max-w-[400px]' +
				' h-[100px] sm:h-[120px] md:h-[140px]' +
				' flex items-center justify-center' +
				' hover:bg-[var(--color1bis)] transition-colors duration-300' +
				' focus:outline-none focus:ring-2 focus:ring-[var(--color1)]';
		});

		// modal box background
		this.addEnterListener();
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');
		this.box.className +=
			' bg-[var(--color3)] p-4 sm:p-6 md:p-10' +
			' relative flex flex-col items-center justify-center' +
			' gap-3 sm:gap-4 w-[90vw] sm:w-auto max-w-[500px] rounded-sm';

		this.btn2plyr.element.focus();
		this.btn2plyr.element.tabIndex = 0;
		this.btn2plyrPwr.element.tabIndex = 0;
		this.btnTourn.element.tabIndex = 0;
		this.btnTournPwr.element.tabIndex = 0;
	}

	private addEnterListener() {
		const buttonConfigs = [
			{ button: this.btn2plyr, player: 2, powerUp: TournamentType.Regular },
			{ button: this.btn2plyrPwr, player: 2, powerUp: TournamentType.Powerup },
			{ button: this.btnTourn, player: 4,powerUp: TournamentType.Regular },
			{ button: this.btnTournPwr, player: 4, powerUp: TournamentType.Powerup },
		];

		buttonConfigs.forEach(({ button, player, powerUp }) => {
			button.element.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.logicRemote(player, powerUp);
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
			});
		});
	}

	private async logicRemote(tournamentSize: number, type: TournamentType) {
		// leaveTournament();
		// const { error } = await apiCall('POST', `/tournaments/leave`);
		// if (error) {
		// 	console.error('Error leaving tournament:', error);
		// 	new TextModal(
		// 		this.parent,
		// 		`Failed to leave tournament: ${error.message}`
		// 	);
		// }
		console.debug('Clearing match data before queuing');
		clearMatchData();
		clearTournData();
		clearOtherGameData();

		state.gameMode = 'remote';
		state.tournamentSize = tournamentSize;
		state.tournamentOngoing = tournamentSize === 4;

		sessionStorage.setItem('gameMode', 'remote');
		sessionStorage.setItem('playerCount', '2');
		sessionStorage.setItem('tournament', tournamentSize == 2 ? '0' : '1');

		sessionStorage.setItem('split', type == TournamentType.Regular ? '0' : '1');
		sessionStorage.setItem('stretch', type == TournamentType.Regular ? '0' : '1');
		sessionStorage.setItem('shrink', type == TournamentType.Regular ? '0' : '1');

		this.destroy();
		new AliasModal(this.parent, 1, type);
	}
}
