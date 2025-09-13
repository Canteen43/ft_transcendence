import { Screen } from '../components/Screen';
import { RemoteGameModal} from '../modals/RemoteGameModal';
import { LocalGameModal} from '../modals/LocalGameModal';
import { AliasModal} from '../modals/AliasModal';
import { isLoggedIn } from '../misc/AuthComponent';

export class HomeScreen extends Screen {
	constructor() {
		super();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		// Main title
		const heading = document.createElement('h1');
		heading.textContent = 'Space Pong';
		heading.className = 'font-rubik text-[150px] text-[var(--color2)] text-center floating-title select-none';
		this.element.appendChild(heading);
		
		// Container for the main 2 buttons
		const mainButtonContainer = document.createElement('div');
		mainButtonContainer.className = 'flex gap-8 mt-8';
		this.element.appendChild(mainButtonContainer);

		// LOCAL Play button
		const localBtn = document.createElement('button');
		localBtn.textContent = 'LOCAL GAME';
		localBtn.className = 'font-sigmar px-10 py-6 text-3xl text-[var(--color1)] font-bold rounded-lg border-4 border-[var(--color1)] hover:text-[var(--color4)]  hover:border-[var(--color4)] transition-all duration-300 shadow-lg';
		localBtn.onclick = () => this.localLogic();

		mainButtonContainer.appendChild(localBtn);

		// REMOTE Play button 
		const remoteBtn = document.createElement('button');
		remoteBtn.textContent = 'REMOTE GAME';
		remoteBtn.className = 'font-sigmar px-10 py-6 text-3xl text-[var(--color1)] font-bold rounded-lg border-4 border-[var(--color1)] hover:text-[var(--color4)] hover:border-[var(--color4)] transition-all duration-300 shadow-lg';
		remoteBtn.onclick = () => this.remoteLogic();
		mainButtonContainer.appendChild(remoteBtn);
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			alert("You must be logged-in to access the remote game");
			return;
		}
		new RemoteGameModal(this.element);
	}

	private localLogic() {
		new LocalGameModal(this.element);
	}

}