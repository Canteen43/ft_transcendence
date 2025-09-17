import { Button } from '../buttons/Button';
import { state } from '../utils/State';
import { AliasModal } from './AliasModal';
import { Modal } from './Modal';

export class LocalGameModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		const img2 = document.createElement('img');
		img2.src = '../../public/2_players.png';
		img2.className = 'h-[100px]';

		const img3 = document.createElement('img');
		img3.src = '../../public/3_players.png';
		img3.className = 'h-[100px]';

		const img4 = document.createElement('img');
		img4.src = '../../public/4_players.png';
		img4.className = 'h-[100px]';

		// create buttons with images inside
		const btn2 = new Button(img2, () => this.setupLocalGame(2), this.box);
		const btn3 = new Button(img3, () => this.setupLocalGame(3), this.box);
		const btn4 = new Button(img4, () => this.setupLocalGame(4), this.box);

		// fixed button size
		[btn2, btn3, btn4].forEach(btn => {
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

	private setupLocalGame(n: number) {
		sessionStorage.setItem('playerCount', n.toString());
		sessionStorage.setItem('thisPlayer', '1');
		sessionStorage.setItem('gameMode', 'local');
		state.gameMode = 'local';
		state.playerCount = n;
		new AliasModal(this.parent, n);
		this.destroy();
	}
}
