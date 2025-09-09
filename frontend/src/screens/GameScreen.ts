import { Screen } from '../components/Screen';
import { Pong3D } from '../game/Pong3D';

export class GameScreen extends Screen {
	private pong3DInstance: Pong3D;

	constructor() {
		super();

		// const video = document.getElementById(
		// 	'background-video'
		// ) as HTMLVideoElement;
		// video.pause();

		// // Keep heading near top, not centered
		// this.element.classList.remove('justify-center');
		// this.element.classList.add('justify-start');

		// // Heading at the top with some margin
		// const heading = document.createElement('h1');
		// heading.textContent = 'Game';
		// heading.className =
		// 	'text-5xl select-none font-semibold text-grey mt-10';
		// this.element.appendChild(heading);

		// // Middle content container
		// const content = document.createElement('div');
		// content.className =
		// 	'flex-1 flex flex-col items-center justify-center text-center text-grey gap-3';
		// this.element.appendChild(content);

		// // Initialize 3D pong
		// const canvas = document.createElement('canvas');
		// canvas.id = 'renderCanvas';
		// canvas.style.width = '100%';
		// canvas.style.height = '100%';
		// this.element.appendChild(canvas);
		// initPongScene();

		// Initialize 3D pong
		this.pong3DInstance = new Pong3D(this.element);

		// // Button for testing navigation
		// void new Button(
		// 	'To TournamentScreen',
		// 	() => {
		// 		location.hash = '#tournament';
		// 	},
		// 	content
		// );
	}

	// Override destroy to properly clean up Pong3D resources
	public destroy() {
		if (this.pong3DInstance) {
			this.pong3DInstance.dispose();
		}
		// Call parent destroy to remove DOM element
		super.destroy();
	}
}
