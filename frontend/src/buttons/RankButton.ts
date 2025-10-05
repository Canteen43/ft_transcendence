import { RankModal } from '../modals/RankModal';
import { state } from '../utils/State';

export class RankButton {
	private button: HTMLButtonElement;
	private img: HTMLImageElement;
	private rankModal?: RankModal;

	constructor(parent: HTMLElement) {
		this.button = document.createElement('button');
		this.button.className =
			'absolute z-10 top-4 left-65 fixed p-0 bg-transparent border-none';

		const imgSrc = '../Leaderboard2.png';
		const hoverImgSrc = '../Leaderboard2.png';

		this.img = document.createElement('img');
		this.img.src = imgSrc;
		this.img.alt = 'Home';
		this.img.className = 'w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18';
		this.button.appendChild(this.img);

		// change image on hover
		this.button.addEventListener('click', this.handleHomeClick);

		parent.appendChild(this.button);
	}

	private handleHomeClick = () => {
		if (!this.rankModal) {
			this.rankModal = new RankModal(this.button.parentElement!);
			this.rankModal.onClose = () => {
				this.rankModal = undefined;
			};
		}
	};

	public destroy() {
		this.rankModal?.destroy();
		this.button.removeEventListener('click', this.handleHomeClick);
		this.button.remove();
	}
}
