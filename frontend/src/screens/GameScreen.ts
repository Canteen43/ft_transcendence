import { Screen } from '../components/Screen';
import { Button } from '../components/Button';

export class GameScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.pause();

		this.element.classList.remove('justify-center');

		const heading = document.createElement('h1');
		heading.textContent = 'Game';
		heading.className =
			'text-5xl font-extrabold select-none font-ps2p text-grey';
		this.element.appendChild(heading);

		void new Button(
			'To TournamentScreen',
			() => {
				location.hash = '#tournament';
			},
			this.element
		);
	}
}
