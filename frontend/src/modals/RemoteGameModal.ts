import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { state } from '../utils/State';
import { AliasModal } from './AliasModal';

export class RemoteGameModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		const img2 = document.createElement('img');
		img2.src = '../../public/2_players.png';
		img2.className = 'h-25  mx-auto';

		const imgt = document.createElement('img');
		imgt.src = '../../public/trophy.png';
		imgt.className = 'h-25  mx-auto';

		const btn2plyr = new Button(img2, () => this.logicRemote(2), this.box);
		const btnTourn = new Button(imgt, () => this.logicRemote(4), this.box);
		btn2plyr.element.style.width = '400px'; // button width
		btn2plyr.element.style.height = '150px'; // button height
		btnTourn.element.style.width = '400px'; // button width
		btnTourn.element.style.height = '150px'; // button height
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');
	}

	private logicRemote(tournamentSize: number) {
		state.gameMode = 'remote';
		state.tournamentSize = tournamentSize;
		this.destroy();
		sessionStorage.setItem('tournament', tournamentSize == 2 ? '0' : '1');
		new AliasModal(this.parent, 1);
	}
}
