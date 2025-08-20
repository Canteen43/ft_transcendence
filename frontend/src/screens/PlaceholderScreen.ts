import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { HomeScreen } from '../screens/HomeScreen';

export class PlaceholderScreen extends Screen {
	constructor() {
		super();

		void new Button(
			'To HomeScreen',
			() => {
				this.destroy();
				void new HomeScreen();
			},
			this.element
		);

		// Set the initial hash to the placeholder screen
		location.hash = '#placeholder';
	}
}
