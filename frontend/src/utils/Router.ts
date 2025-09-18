import { GameScreen } from '../screens/GameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { Screen } from '../screens/Screen';
import { TournamentScreen } from '../screens/TournamentScreen';

export class Router {
	public currentScreen: Screen | null = null;

	public init() {
		// This will ensure destroy functions are called
		window.addEventListener('beforeunload', () => {
			if (this.currentScreen) {
				this.currentScreen.destroy();
			}
		});

		// This is the proper routing logic
		location.hash = location.hash || '#home'; // Default to #home if no hash
		window.addEventListener('hashchange', () => this.handleRoute());
		this.handleRoute(); // Initial route won't trigger hashchange so call it manually
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

export const router = new Router();
