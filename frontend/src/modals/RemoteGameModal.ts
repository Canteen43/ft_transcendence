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
	constructor(parent: HTMLElement) {
		super(parent);

		clearMatchData();
		clearTournData();
		clearOtherGameData();
		state.tournamentOngoing = false;

		const img2 = document.createElement('img');
		img2.src = '../../public/2_players.png';
		img2.className = 'h-25  mx-auto';

		const imgt = document.createElement('img');
		imgt.src = '../../public/trophy.png';
		imgt.className = 'h-25  mx-auto';

		const btn2plyr = new Button(img2, () => this.logicRemote(2), this.box);
		const btnTourn = new Button(imgt, () => this.logicRemote(4), this.box);

		// fixed button size
		[btn2plyr, btnTourn].forEach(btn => {
			btn.element.classList.add(
				'w-[300px]',
				'h-[120px]',
				'flex',
				'items-center',
				'justify-center',
				'hover:bg-[var(--color1bis)]',
				'transition-colors',
				'duration-300'
			);
		});

		// modal box background
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');
	}

	private logicRemote(tournamentSize: number) {
		state.gameMode = 'remote';
		state.tournamentOngoing = true;
		state.tournamentSize = tournamentSize;
		if (tournamentSize == 4) {
			state.tournamentOngoing = true;
		} else {
			state.tournamentOngoing = false;
		}
		sessionStorage.setItem('playerCount', '2');
		this.destroy();
		sessionStorage.setItem('tournament', tournamentSize == 2 ? '0' : '1');
		new AliasModal(this.parent, 1);
	}
}
