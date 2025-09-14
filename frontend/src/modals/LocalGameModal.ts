import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { AliasModal } from './AliasModal';

export class LocalGameModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		const img2 = document.createElement('img');
		img2.src = '../../public/2_astronauts.png';
		img2.className = 'h-25  mx-auto';

		const img3 = document.createElement('img');
		img3.src = '../../public/3_astronauts.png';
		img3.className = 'h-25  mx-auto';

		const img4 = document.createElement('img');
		img4.src = '../../public/4_astronauts.png';
		img4.className = 'h-25  mx-auto';

		const btn2 = new Button(img2, () => this.setupLocalGame(2), this.box);
		const btn3 = new Button(img3, () => this.setupLocalGame(3), this.box);
		const btn4 = new Button(img4, () => this.setupLocalGame(4), this.box);
		btn2.element.style.width = '400px'; // button width
		btn2.element.style.height = '150px'; // button height
		btn3.element.style.width = '400px'; // button width
		btn3.element.style.height = '150px'; // button height
		btn4.element.style.width = '400px'; // button width
		btn4.element.style.height = '150px'; // button height
		this.box.style.backgroundColor = 'var(--color3)';
		this.box.classList.remove('shadow-lg');
	}

	private setupLocalGame(n: number) {
		sessionStorage.setItem('playerCount', n.toString());
		sessionStorage.setItem('thisPlayer', '1');
		sessionStorage.setItem('gameMode', 'local');
		new AliasModal(this.parent, n);
		this.destroy();
	}
}
