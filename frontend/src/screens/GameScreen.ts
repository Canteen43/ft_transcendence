import { Screen } from '../components/Screen';
import { Button } from '../components/Button';

export class GameScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.pause();

		void new Button(
			'To TournamentScreen',
			() => {
				location.hash = '#tournament';
			},
			this.element
		);
	}
}
