import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import type { GameOptions } from '../misc/GameOptions';
import { apiCall } from '../utils/apiCall';
import { WaitingModal } from './WaitingModal';
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

	private _2_players() {
		// this.joinGame(2);
		new WaitingModal1v1(this.box);
	}

	private _tournament() {
		// this.joinGame(4);
		new WaitingModal(this.box);
	}

	// private joinGame(playerCount: number) {
	// 	const ret = apiCall('POST', `/users${sessionStorage.getItem('username')}`, null, null);
	// }
}
