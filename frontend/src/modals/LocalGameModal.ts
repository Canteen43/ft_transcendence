import { Button } from '../buttons/Button';
import { state } from '../utils/State';
import { clearAllGameData } from '../utils/clearSessionStorage';
import { LocalMobileSetupModal } from './LocalMobileSetupModal';
import { LocalSetupModal } from './LocalSetupModal';

import { Modal } from './Modal';

export class LocalGameModal extends Modal {
	private btn2: Button;
	private btn3: Button;
	private btn4: Button;
	private btnT: Button;

	constructor(parent: HTMLElement) {
		super(parent);
		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;

		const img2 = document.createElement('img');
		img2.src = '2p.png';
		img2.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const img3 = document.createElement('img');
		img3.src = '3p.png';
		img3.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const img4 = document.createElement('img');
		img4.src = '4p.png';
		img4.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		const imgt = document.createElement('img');
		imgt.src = 'trophy.png';
		imgt.className = 'h-10 sm:h-14 md:h-18 w-auto object-contain';

		this.btn2 = new Button(
			img2,
			() => this.setupLocalGame(2, false),
			this.box
		);
		this.btn3 = new Button(
			img3,
			() => this.setupLocalGame(3, false),
			this.box
		);
		this.btn4 = new Button(
			img4,
			() => this.setupLocalGame(4, false),
			this.box
		);
		this.btnT = new Button(
			imgt,
			() => this.setupLocalGame(4, true),
			this.box
		);

		// Fixed button size
		[this.btn2, this.btn3, this.btn4, this.btnT].forEach(btn => {
			btn.element.className +=
				' w-full' +
				' min-h-[30px] sm:min-h-[80px] md:min-h-[100px]' +
				' flex items-center justify-center' +
				' p-1 sm:p-2 md:p-3' +
				' hover:bg-[var(--color1bis)] transition-colors duration-300' +
				' focus:outline-none focus:ring-2 focus:ring-[var(--color1)]';
		});

		// Modal box background
		this.box.classList.remove('shadow-lg', 'bg-white/70');
		this.box.className +=
			' bg-[var(--color3)]' +
			' relative grid place-items-center' +
			' w-[160px] sm:w-auto max-w-[160px] sm:max-w-[400px] rounded-sm' +
			' grid-cols-1 sm:grid-cols-2';
	}

	private setupLocalGame(n: number, tourn: boolean): void {
		const gameMode = sessionStorage.getItem('gameMode');
		if (!gameMode || gameMode !== 'local') {
			sessionStorage.removeItem('alias1');
			sessionStorage.removeItem('alias2');
		}

		clearAllGameData();
		state.gameMode = 'local';
		sessionStorage.setItem('gameMode', 'local');
		sessionStorage.setItem('playerCount', n.toString());
		sessionStorage.setItem('thisPlayer', '1');
		sessionStorage.setItem('tournament', tourn ? '1' : '0');

		if (state.isMobile === true) {
			new LocalMobileSetupModal(this.parent, n, 0);
		} else {
			new LocalSetupModal(this.parent, n, 0);
		}
		this.destroy();
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		this.btn2?.destroy();
		this.btn3?.destroy();
		this.btn4?.destroy();
		this.btnT?.destroy();

		super.destroy();
	}
}
