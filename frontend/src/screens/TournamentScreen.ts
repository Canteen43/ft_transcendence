import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { WaitingModal } from '../modals/WaitingModal';

export class TournamentScreen extends Screen {
	constructor() {
		super();

		// const video = document.getElementById(
		// 	'background-video'
		// ) as HTMLVideoElement;
		// video.play();

		// Keep heading near top, not centered
		this.element.classList.remove('justify-center');
		this.element.classList.add('justify-start');

		// Heading at the top with some margin
		const heading = document.createElement('h1');
		heading.textContent = 'Tournament';
		heading.className =
			'text-5xl select-none font-semibold text-grey mt-10';
		this.element.appendChild(heading);

		// Middle content container
		const content = document.createElement('div');
		content.className =
			'flex-1 flex flex-col items-center justify-center text-center text-grey';
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
