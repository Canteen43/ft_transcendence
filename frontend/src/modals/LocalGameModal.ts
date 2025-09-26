import { Button } from '../buttons/Button';
import { state } from '../utils/State';
import { AliasModal } from './AliasModal';
import { Modal } from './Modal';

export class LocalGameModal extends Modal {
	private btn2: Button;
	private btn3: Button;
	private btn4: Button;

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
		this.btn2 = new Button(img2, () => this.setupLocalGame(2), this.box);
		this.btn3 = new Button(img3, () => this.setupLocalGame(3), this.box);
		this.btn4 = new Button(img4, () => this.setupLocalGame(4), this.box);

		// fixed button size
		[this.btn2, this.btn3, this.btn4].forEach(btn => {
			btn.element.classList.add(
				'w-[300px]',
				'h-[120px]',
				'flex',
				'items-center',
				'justify-center',
				'hover:bg-[var(--color1bis)]',
				'transition-colors',
				'duration-300',
				'focus:outline-none',
				'focus:ring-2',
				'focus:ring-[var(--color1)]'
			);
		});

		// modal box background
		this.addEnterListener();
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');

		this.btn2.element.focus();
		this.btn2.element.tabIndex = 0;
		this.btn3.element.tabIndex = 0;
		this.btn4.element.tabIndex = 0;
	}

	private addEnterListener() {
		const buttonConfigs = [
			{ button: this.btn2, player: 2 },
			{ button: this.btn3, player: 3 },
			{ button: this.btn4, player: 4 },
		];

		buttonConfigs.forEach(({ button, player }) => {
			button.element.addEventListener('keydown', (e: KeyboardEvent) => {

				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.setupLocalGame(player);
				}

				// Arrow key navigation
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
					e.preventDefault();
					const buttons = [this.btn2, this.btn3, this.btn4];
					const currentIndex = buttons.indexOf(button);
					const nextIndex = (currentIndex + 1) % buttons.length;
					buttons[nextIndex].element.focus();
				}

				if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
					e.preventDefault();
					const buttons = [this.btn2, this.btn3, this.btn4];
					const currentIndex = buttons.indexOf(button);
					const prevIndex =
						(currentIndex - 1 + buttons.length) % buttons.length;
					buttons[prevIndex].element.focus();
				}
			});
		});
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
