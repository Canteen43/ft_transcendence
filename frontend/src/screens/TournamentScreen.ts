import { Screen } from '../components/Screen';
import { Button } from '../components/Button';

export class TournamentScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.play();

		this.element.classList.remove('justify-center');

		const heading = document.createElement('h1');
		heading.textContent = 'Tournament';
		heading.className =
			'text-5xl font-extrabold select-none font-ps2p text-grey';
		this.element.appendChild(heading);

		const content = document.createElement('div');
		content.className = 'text-center text-grey flex-1 justify-center';
		this.element.appendChild(content);

		// Button container
		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'flex space-x-4 justify-center';
		content.appendChild(buttonContainer);

		void new Button(
			'To HomeScreen',
			() => {
				location.hash = '#home';
			},
			buttonContainer
		);
		void new Button(
			'To GameScreen',
			() => {
				location.hash = '#game';
			},
			buttonContainer
		);
	}
}
