import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import type { GameOptions } from '../misc/GameOptions';
import { state } from '../misc/state';

export let gameOptions: GameOptions | null = null;

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
		gameOptions = {
			type: 'local',
			playerCount: 2,
			thisPlayer: 1,
		};
		state.playerCount = 2;
		state.thisPlayer = 1;
		location.hash = '#game';
	}

	private _3_players() {
		gameOptions = {
			type: 'local',
			playerCount: 3,
			thisPlayer: 1,
		};
		state.playerCount = 3;
		state.thisPlayer = 1;
		location.hash = '#game';
	}

	private _4_players() {
		gameOptions = {
			type: 'local',
			playerCount: 4,
			thisPlayer: 1,
		};
		location.hash = '#game';
	}
}
