import { hourglass, jelly, newtonsCradle } from 'ldrs';
import { MESSAGE_ACCEPT, MESSAGE_REPLAY } from '../../../shared/constants';
import {
	CreateTournamentApiSchema,
	FullTournamentSchema,
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { router } from '../utils/Router';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';
import { ReadyModal } from './ReadyModal';
import { TextModal } from './TextModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, eventListener for game Ready
export class ReplayModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		const textElmt = document.createElement('p');
		textElmt.className = 'text-center text-lg text-[var(--color3)]';
		this.box.appendChild(textElmt);
		this.box.classList.add('replay-modal');
		new Button('Replay', () => this.replayClicked(), parent);
		this.showLoader();
	}

	private replayClicked() {
		const matchID = sessionStorage.getItem('matchID');
		if (!matchID) {
			new TextModal(this.box, 'No match ID found');
			console.error('No match ID found in session storage');
			return;
		}
		console.debug({ matchID });
		webSocket.send({ t: MESSAGE_ACCEPT, d: matchID });
	}

	private showLoader() {
		// Clear the button content but keep button styling
		this.box.innerHTML = '';

		this.box.classList.remove('hover:bg-whatever');
		this.box.classList.add('cursor-not-allowed');
		this.box.style.backgroundColor = 'white';
		this.box.style.border = '2px solid white';

		// Add loader
		const container = document.createElement('div');
		container.className = 'flex items-center justify-center';

		const loader = document.createElement('l-hourglass');
		loader.setAttribute('size', '40');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');

		container.appendChild(loader);
		this.box.appendChild(container);
	}

	// private async printMessageLoader() {
	// 	const container = document.createElement('div');
	// 	container.className = 'flex flex-col items-center';

	// 	const message = document.createElement('p');
	// 	message.textContent = 'Waiting for other player(s)...';
	// 	message.className =
	// 		"font-outfit [font-variation-settings:'wght'_900] text-3xl font-bold text-center mb-5 text-[var(--color3)]";
	// 	container.appendChild(message);

	// 	const loader = document.createElement('l-jelly');
	// 	loader.setAttribute('size', '60');
	// 	loader.setAttribute('speed', '1.5');
	// 	loader.setAttribute('color', 'var(--color3)');
	// 	container.appendChild(loader);

	// 	this.box.appendChild(container);
	// }

	// private async joinGame(targetSize: number): Promise<void> {
	// 	const joinData = {
	// 		size: targetSize,
	// 		alias: sessionStorage.getItem('alias'),
	// 	};

	// 	const parseInput = JoinTournamentSchema.safeParse(joinData);
	// 	if (!parseInput.success) {
	// 		this.showError('Invalid tournament format', parseInput.error);
	// 		return;
	// 	}

	// 	console.debug('Sending to /tournaments/join:', joinData);
	// 	const { data: playerQueue, error } = await apiCall(
	// 		'POST',
	// 		'/tournaments/join',
	// 		TournamentQueueSchema,
	// 		joinData
	// 	);
	// 	if (error) {
	// 		this.showError(
	// 			`Error ${error.status}: ${error.statusText}, ${error.message}`
	// 		);
	// 		return;
	// 	}
	// 	if (!playerQueue) {
	// 		this.showError('No response from tournament creation');
	// 		return;
	// 	}
	// 	await this.handlePlayerQueue(playerQueue, targetSize);
	// }

	// private async handlePlayerQueue(
	// 	playerQueue: any,
	// 	targetSize: number
	// ): Promise<void> {
	// 	console.log('Tournament (game) actual players:', playerQueue.queue);
	// 	const currentPlayers = playerQueue.queue.length;
	// 	const isTournamentReady = currentPlayers === targetSize;

	// 	sessionStorage.setItem('thisPlayer', currentPlayers.toString());
	// 	sessionStorage.setItem('targetSize', targetSize.toString());
	// 	sessionStorage.setItem('gameMode', 'remote');

	// 	if (isTournamentReady) {
	// 		await this.createTournament(playerQueue);
	// 	}
	// }

	// private async createTournament(playerQueue: any): Promise<void> {
	// 	const body = {
	// 		creator: sessionStorage.getItem('userID') || '',
	// 		participants: playerQueue.queue,
	// 	};

	// 	const parseInput = CreateTournamentApiSchema.safeParse(body);
	// 	if (!parseInput.success) {
	// 		this.showError(
	// 			'Invalid tournament creation data',
	// 			parseInput.error
	// 		);
	// 		return;
	// 	}

	// 	console.log('Sending to /tournaments:', body);
	// 	const { data: tournament, error } = await apiCall(
	// 		'POST',
	// 		'/tournaments',
	// 		TournamentSchema,
	// 		body
	// 	);

	// 	if (error) {
	// 		this.showError(
	// 			`Error ${error.status}: ${error.statusText}, ${error.message}`
	// 		);
	// 		await this.leaveTournament();
	// 		return;
	// 	}

	// 	if (tournament) {
	// 		console.info('Tournament created with ID:', tournament.id);
	// 		sessionStorage.setItem('tournamentID', tournament.id);
	// 	} else {
	// 		this.showError('Failed to create tournament. Leaving queue.');
	// 		await this.leaveTournament();
	// 	}
	// }

	// private async leaveTournament(): Promise<void> {
	// 	const { error } = await apiCall('POST', '/tournaments/leave');
	// 	if (error) {
	// 		console.error('Error leaving tournament:', error);
	// 		this.showError(`Failed to leave tournament: ${error.message}`);
	// 	}
	// }

	// private showError(message: string, zodError?: z.ZodError): void {
	// 	new TextModal(this.parent, message);
	// 	if (zodError) {
	// 		console.error('Validation failed:', z.treeifyError(zodError));
	// 	}
	// 	console.error(message);
	// }

	// public async quit() {
	// 	const { error } = await apiCall('POST', `/tournaments/leave`);
	// 	if (error) {
	// 		console.error('Error leaving tournament:', error);
	// 		new TextModal(
	// 			this.parent,
	// 			`Failed to leave tournament: ${error.message}`
	// 		);
	// 	}
	// 	super.quit();
	// }

	// public destroy(): void {
	// 	super.destroy();
	// }
}
