import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import type { GameOptions } from '../misc/GameOptions';
import { WaitingModal1v1 } from './WaitingModal1v1';

export let gameOptions: GameOptions | null = null;

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
		new Button('2 players', () => this._2_players(), this.box);
		new Button('tournament', () => this._tournament(), this.box);
	}

	private _2_players() {
		new WaitingModal1v1(this.box);
	}

	private _tournament() {
		location.hash = '#tournament';
	}
}
