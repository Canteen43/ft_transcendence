export class HomeButton {
	private button: HTMLButtonElement;
	private img: HTMLImageElement;

	constructor(
		parent: HTMLElement,
		imgSrc: string = '../home_empty_white.png',
		hoverImgSrc: string = '../home_full_white.png'
	) {
		this.button = document.createElement('button');
		this.button.className =
			'absolute top-4 left-4 fixed p-0 bg-transparent border-none';

		this.img = document.createElement('img');
		this.img.src = imgSrc;
		this.img.alt = 'Home';
		this.img.className = 'w-16 h-16';
		this.button.appendChild(this.img);

		// change image on hover
		this.button.addEventListener(
			'mouseenter',
			() => (this.img.src = hoverImgSrc)
		);
		this.button.addEventListener(
			'mouseleave',
			() => (this.img.src = imgSrc)
		);

		this.button.addEventListener('click', this.handleHomeClick);

		parent.appendChild(this.button);
	}

	private handleHomeClick = () => {
		location.hash = '#home';
	};

	destroy() {
		this.button.removeEventListener('click', this.handleHomeClick);
		this.button.remove();
	}
}
