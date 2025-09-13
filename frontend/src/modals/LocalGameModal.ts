import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { AliasModal } from './AliasModal';

export class LocalGameModal extends Modal {

	constructor(parent: HTMLElement) {
		super(parent);
		new Button('2 players', () => this.setupLocalGame(2), this.box);
		new Button('3 players', () => this.setupLocalGame(3), this.box);
		new Button('4 players', () => this.setupLocalGame(4), this.box);
	}

	private setupLocalGame(n: number) {
		sessionStorage.setItem('playerCount', n.toString());
		sessionStorage.setItem('thisPlayer', '1');
		sessionStorage.setItem('gameMode', 'local');
		new AliasModal(this.parent, n);
		// location.hash = '#game';
	}
}
