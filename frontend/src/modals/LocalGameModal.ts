import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

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
		new Button('2 players', () => this.startLocalGame(2), this.box);
		new Button('3 players', () => this.startLocalGame(3), this.box);
		new Button('4 players', () => this.startLocalGame(4), this.box);
	}
	private startLocalGame(n: number) {
		sessionStorage.setItem('playerCount', n.toString());
		sessionStorage.setItem('thisPlayer', '1');
		sessionStorage.setItem('gameMode', 'local');
		location.hash = '#game';
	}
}
