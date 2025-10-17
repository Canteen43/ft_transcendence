import { TextModal } from '../modals/TextModal';
import { state } from '../utils/State';
import { clearRemoteData } from '../utils/clearSessionStorage';

export class HomeButton {
	private button: HTMLButtonElement;
	private img: HTMLImageElement;
	private onEnter: () => void;
	private onLeave: () => void;
	private textModal?: TextModal;

	constructor(parent: HTMLElement) {
		this.button = document.createElement('button');
		this.button.className =
			'absolute z-10 top-4 left-4 fixed p-0 bg-transparent border-none';

		const imgSrc = '../home_empty_white.png';
		const hoverImgSrc = '../home_full_white.png';

		this.img = document.createElement('img');
		this.img.src = imgSrc;
		this.img.alt = 'Home';
		this.img.className = 'w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16';
		this.button.appendChild(this.img);

		this.onEnter = () => (this.img.src = hoverImgSrc);
		this.onLeave = () => (this.img.src = imgSrc);

		// change image on hover
		this.button.addEventListener('mouseenter', this.onEnter);
		this.button.addEventListener('mouseleave', this.onLeave);
		this.button.addEventListener('click', this.handleHomeClick);

		parent.appendChild(this.button);
	}

	private handleHomeClick = () => {
		if (location.hash === '#game' && state.gameOngoing) {
			this.textModal = new TextModal(
				this.button.parentElement!,
				undefined,
				'Leave',
				() => {
					clearRemoteData();
					location.hash = '#home';
				}
			);
		} else location.hash = '#home';
	};

	destroy() {
		this.textModal?.destroy();
		this.button.removeEventListener('mouseenter', this.onEnter);
		this.button.removeEventListener('mouseleave', this.onLeave);
		this.button.removeEventListener('click', this.handleHomeClick);
		this.button.remove();
	}
}
