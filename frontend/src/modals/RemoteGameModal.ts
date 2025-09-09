import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import type { GameOptions } from '../misc/GameOptions';

export let gameOptions: GameOptions | null = null;

export class RemoteGameModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		new Button('2 players', () => this._2_players(), this.box);
		new Button('tournament', () => this._tournament(), this.box);
	}

	private _2_players() {
		location.hash = '#';
	}

	private _tournament() {
		location.hash = '#tournament';
	}
}