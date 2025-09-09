import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { WaitingModal1v1 } from './WaitingModal1v1';


export class RemoteGameModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add(
			'flex',
			'flex-col',
			'items-center',
			'justify-center',
			'gap-2',
			'p-4'
		);
		new Button('2 players', () => this._createRemote2players(), this.box);
		new Button('tournament', () => this.createTournament(), this.box);
	}

	private _createRemote2players() {
		new WaitingModal1v1(this.box);
	}

	private createTournament() {
		location.hash = '#tournament';
	}
}
