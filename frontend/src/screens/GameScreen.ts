import * as BABYLON from 'babylonjs';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';

export class GameScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.pause();

		// Keep heading near top, not centered
		this.element.classList.remove('justify-center');
		this.element.classList.add('justify-start');

		// Heading at the top with some margin
		const heading = document.createElement('h1');
		heading.textContent = 'Game';
		heading.className =
			'text-5xl select-none font-semibold text-grey mt-10';
		this.element.appendChild(heading);

		// Middle content container
		const content = document.createElement('div');
		content.className =
			'flex-1 flex flex-col items-center justify-center text-center text-grey gap-3';
		this.element.appendChild(content);

		// Adding 3D rendering canvas
		const canvas = document.createElement('canvas');
		canvas.className = 'w-full h-full';
		content.appendChild(canvas);
		const engine = new BABYLON.Engine(canvas, true);
		const scene = new BABYLON.Scene(engine);

		const camera = new BABYLON.FreeCamera(
			'camera1',
			new BABYLON.Vector3(0, 5, -10),
			scene
		);
		camera.setTarget(BABYLON.Vector3.Zero());
		camera.attachControl(canvas, true);

		const light = new BABYLON.HemisphericLight(
			'light',
			new BABYLON.Vector3(0, 1, 0),
			scene
		);
		BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);

		engine.runRenderLoop(() => scene.render());

		// Button for testing navigation
		void new Button(
			'To TournamentScreen',
			() => {
				location.hash = '#tournament';
			},
			content
		);
	}
}
