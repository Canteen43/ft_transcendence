import { TextModal } from '../modals/TextModal';
import { GameScreen } from '../screens/GameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { Screen } from '../screens/Screen';
import { TournamentScreen } from '../screens/TournamentScreen';

// router instance is never destroyed, the event listeners will remain active
// for the lifetime of the page. usually fine for a single-page app.

export class Router {
	public currentScreen: Screen | null = null;

	public init(): void {

		// routing logic
		location.hash = location.hash || '#home';
		window.addEventListener('hashchange', () => this.handleRoute());
		this.handleRoute(); 
	}

	private handleRoute(): void {
		const hash = location.hash;

		if (this.currentScreen) {
			console.info('this.currentScreen.destroy() : ', this.currentScreen);
			this.currentScreen.destroy();
			this.currentScreen = null;
		}

		switch (hash) {
			case '#home':
				console.info('Switching to #HOME');
				this.currentScreen = new HomeScreen();
				break;
			case '#game':
				console.info('Switching to #GAME');
				this.currentScreen = new GameScreen();
				break;
			case '#tournament':
				console.info('Switching to #TOURNAMENT');
				this.currentScreen = new TournamentScreen();
				break;
			default:
				console.warn('Unknown route: ' + hash + '. Redirected to home.');
				location.hash = '#home';
		}
	}
}

export const router = new Router();
