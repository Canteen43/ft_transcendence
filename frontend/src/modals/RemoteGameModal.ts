import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import {
	clearMatchData,
	clearOtherGameData,
	clearTournData,
} from '../utils/cleanSessionStorage';
import { state } from '../utils/State';
import { AliasModal } from './AliasModal';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

export class RemoteGameModal extends Modal {
	private btn2plyr: Button;
	private btnTourn: Button;

	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add('remote-modal');

		const img2 = document.createElement('img');
		img2.src = '2_players.png';
		img2.className = 'h-16 sm:h-20 md:h-[100px]';

		const imgt = document.createElement('img');
		imgt.src = 'trophy.png';
		imgt.className = 'h-16 sm:h-20 md:h-[100px]';

		this.btn2plyr = new Button(img2, () => this.logicRemote(2), this.box);
		this.btnTourn = new Button(imgt, () => this.logicRemote(4), this.box);

		// fixed button size
		[this.btn2plyr, this.btnTourn].forEach(btn => {
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
			'bg-[var(--color3)] p-4 sm:p-6 md:p-10' +
			' relative flex flex-col items-center justify-center' +
			' gap-3 sm:gap-4 w-[90vw] sm:w-auto max-w-[500px]';

		this.btn2plyr.element.focus();
		this.btn2plyr.element.tabIndex = 0;
		this.btnTourn.element.tabIndex = 0;
	}

	private addEnterListener() {
		const buttonConfigs = [
			{ button: this.btn2plyr, player: 2 },
			{ button: this.btnTourn, player: 4 },
		];

		buttonConfigs.forEach(({ button, player }) => {
			button.element.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.logicRemote(player);
				}

				// Arrow key navigation
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
					e.preventDefault();
					const buttons = [this.btn2plyr, this.btnTourn];
					const currentIndex = buttons.indexOf(button);
					const nextIndex = (currentIndex + 1) % buttons.length;
					buttons[nextIndex].element.focus();
				}

				if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
					e.preventDefault();
					const buttons = [this.btn2plyr, this.btnTourn];
					const currentIndex = buttons.indexOf(button);
					const prevIndex =
						(currentIndex - 1 + buttons.length) % buttons.length;
					buttons[prevIndex].element.focus();
				}
			});
		});
	}

	private async logicRemote(tournamentSize: number) {
		const { error } = await apiCall('POST', `/tournaments/leave`);
		if (error) {
			console.error('Error leaving tournament:', error);
			new TextModal(
				this.parent,
				`Failed to leave tournament: ${error.message}`
			);
		}
		clearMatchData();
		clearTournData();
		clearOtherGameData();

		state.gameMode = 'remote';
		state.tournamentSize = tournamentSize;
		state.tournamentOngoing = (tournamentSize === 4);

		sessionStorage.setItem('playerCount', '2');
		sessionStorage.setItem('tournament', tournamentSize == 2 ? '0' : '1');

		this.destroy();
		new AliasModal(this.parent, 1);
	}
}
