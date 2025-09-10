import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { state } from '../misc/state';


export class LocalGameModal extends Modal {
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
		new Button('2 players', () => this._2_players(), this.box);
		new Button('3 players', () => this._3_players(), this.box);
		new Button('4 players', () => this._4_players(), this.box);
	}

	private _2_players() {
		state.playerCount = 2;
		state.thisPlayer = 1;
		location.hash = '#game';
	}

	private _3_players() {
		state.playerCount = 3;
		state.thisPlayer = 1;
		location.hash = '#game';
	}

	private _4_players() {
		state.playerCount = 4;
		state.thisPlayer = 1;
		location.hash = '#game';
	}
}
