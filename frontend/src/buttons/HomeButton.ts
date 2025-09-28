import { TextModal } from '../modals/TextModal';
import { state } from '../utils/State';

export class HomeButton {
	private button: HTMLButtonElement;
	private img: HTMLImageElement;
	private onEnter: () => void;
	private onLeave: () => void;


	constructor(
		parent: HTMLElement,
		imgSrc: string = '../home_empty_black.png',
		hoverImgSrc: string = '../home_full_black.png'
	) {
		this.button = document.createElement('button');
		this.button.className =
			'absolute z-10 top-4 left-4 fixed p-0 bg-transparent border-none';
			'absolute z-10 top-4 left-4 fixed p-0 bg-transparent border-none';

		this.img = document.createElement('img');
		this.img.src = imgSrc;
		this.img.alt = 'Home';
		this.img.className = 'w-18 h-18';
		this.button.appendChild(this.img);

		this.onEnter = () => (this.img.src = hoverImgSrc);
		this.onLeave = () => (this.img.src = imgSrc);

		this.onEnter = () => (this.img.src = hoverImgSrc);
		this.onLeave = () => (this.img.src = imgSrc);

		// change image on hover
		this.button.addEventListener('mouseenter', this.onEnter);
		this.button.addEventListener('mouseleave', this.onLeave);
		this.button.addEventListener('mouseenter', this.onEnter);
		this.button.addEventListener('mouseleave', this.onLeave);
		this.button.addEventListener('click', this.handleHomeClick);

		parent.appendChild(this.button);
	}

	private handleHomeClick = () => {
		if (location.hash === '#game' || state.gameOngoing) {
			new TextModal(
				this.button.parentElement!,
				undefined,
				'Leave',
				() => {
					location.hash = '#home';
				}
			);
		} else location.hash = '#home';
	};

	destroy() {
		this.button.removeEventListener('mouseenter', this.onEnter);
		this.button.removeEventListener('mouseleave', this.onLeave);
		this.button.removeEventListener('mouseenter', this.onEnter);
		this.button.removeEventListener('mouseleave', this.onLeave);
		this.button.removeEventListener('click', this.handleHomeClick);
		this.button.remove();
	}
}
