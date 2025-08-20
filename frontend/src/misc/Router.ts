import { Screen } from '../components/Screen'; // import your base Screen class
import { HomeScreen } from '../screens/HomeScreen';
import { TournamentScreen } from '../screens/TournamentScreen';
import { GameScreen } from '../screens/GameScreen';

export class Router {
	private currentScreen: Screen | null = null;

	constructor() {
		window.addEventListener('hashchange', () => this.handleRoute());
		location.hash = '#home';
	}

	private handleRoute() {
		const hash = location.hash;

		if (this.currentScreen) {
			this.currentScreen.destroy();
			this.currentScreen = null;
		}

		switch (hash) {
			case '#home':
				this.currentScreen = new HomeScreen();
				break;
			case '#game':
				this.currentScreen = new GameScreen();
				break;
			case '#tournament':
				this.currentScreen = new TournamentScreen();
				break;
			default:
				alert('Unknown route: ' + hash + '. Redirected to home.');
				location.hash = '#home';
		}
	}
}
