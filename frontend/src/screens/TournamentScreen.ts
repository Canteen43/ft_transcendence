import { Screen } from '../components/Screen';
import { Button } from '../components/Button';

export class TournamentScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.play();

		// Button container
		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'flex space-x-4 justify-center';
		this.element.appendChild(buttonContainer);

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
