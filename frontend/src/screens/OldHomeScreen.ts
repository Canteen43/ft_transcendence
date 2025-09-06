 import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { LoginButton } from '../misc/LoginButton';
import { webSocket } from '../misc/WebSocketWrapper';
import { PlaceholderModal } from '../modals/PlaceholderModal';
import { Remote2PlayerModal } from '../modals/RemotePlayerModal';

export let gameOptions: GameOptions | null = null;

export class HomeScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById(
			'background-video'
		) as HTMLVideoElement;
		video.play();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		// Heading
		const heading = document.createElement('h1');
		heading.textContent = 'transcendence';
		heading.className =
			'text-7xl font-extrabold select-none font-ps2p text-white';
		heading.style.textShadow = `2px 2px 0px pink, -2px 2px 0px pink, 2px -2px 0px pink, -2px -2px 0px pink`;
		this.element.appendChild(heading);

		// Button container
		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'flex space-x-4 justify-center';
		this.element.appendChild(buttonContainer);

		// Buttons
		void new LoginButton(this.element);

		void new Button(
			'Postman Mock-Request',
			async () => {
				try {
					const res = await fetch(
						'https://1a7b7860-26ef-49a8-b367-439c7ea4ea05.mock.pstmn.io/users'
					);
					const data = await res.json();
					alert(JSON.stringify(data, null, 2));
				} catch {
					alert('Error fetching data');
				}
			},
			buttonContainer
		);
		void new Button(
			'Create Test User',
			async () => {
				const timestamp = Date.now();
				const newUser = {
					login: `test_${timestamp}`,
					// login: `helene`,
					first_name: 'Test',
					last_name: 'User',
					email: 'test.user@example.com',
					password_hash: 'supersecret',
				};

				try {
					const res = await fetch('http://localhost:8080/users', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(newUser),
					});

					if (!res.ok) {
						const errText = await res.text(); // backend error message
						throw new Error(errText);
					}

					const data = await res.json();
					alert(JSON.stringify(data, null, 2));
				} catch (err) {
					alert('Error creating user: ' + err);
					console.error(err);
				}
			},
			buttonContainer
		);
		void new Button(
			'Local 1v1',
			() => {
				gameOptions = {
					type: 'local',
					playerCount: 2,
					thisPlayer: 1,
				};
				location.hash = '#game';
			},
			buttonContainer
		);
		void new Button(
			'Local 1vAI',
			() => {
				void new PlaceholderModal(this.element);
			},
			buttonContainer
		);
		void new Button(
			'Remote 1v1',
			() => {
				void new Remote2PlayerModal(this.element);
			},
			buttonContainer
		);
		void new Button(
			'Tournament',
			() => {
				void new PlaceholderModal(this.element);
			},
			buttonContainer
		);
		void new Button(
			'Test WebSocket',
			() => {
				webSocket.send(JSON.stringify({
					t: 'test',
					d: 'Test message!'
				}));
			},
			buttonContainer
		);
		void new Button(
			'To TournamentScreen',
			() => {
				location.hash = '#tournament';
			},
			buttonContainer
		);
	}
} *//* 
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { LoginButton } from '../misc/LoginButton';
import { webSocket } from '../misc/WebSocketWrapper';
import { PlaceholderModal } from '../modals/PlaceholderModal';
import { Remote2PlayerModal } from '../modals/RemotePlayerModal';


export let gameOptions: GameOptions | null = null;

export class HomeScreen extends Screen {
	constructor() {
		super();

		const video = document.getElementById('background-video') as HTMLVideoElement;
		video.play();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-8';

		// Login button top-right
		void new LoginButton(this.element);

		// Main content container - perfectly centered
		const mainContainer = document.createElement('div');
		mainContainer.className = 'flex flex-col items-center justify-center flex-1';
		this.element.appendChild(mainContainer);

		// Title
		const heading = document.createElement('h1');
		heading.textContent = 'PONG';
		heading.className =
			'text-9xl font-extrabold select-none font-ps2p text-white mb-16 text-center';
		heading.style.textShadow = `2px 2px 0px #ff79c6, -2px 2px 0px #ff79c6, 2px -2px 0px #ff79c6, -2px -2px 0px #ff79c6`;
		mainContainer.appendChild(heading);

		// Panels container
		const panelsContainer = document.createElement('div');
		panelsContainer.className = 'flex w-full max-w-6xl justify-center gap-6';
		mainContainer.appendChild(panelsContainer);

		// Panel definitions
		const panels = [
			{
				title: 'PLAY LOCALLY',
				buttons: [
					{ label: '2 players', players: 2 },
					{ label: '3 players', players: 3 },
					{ label: '4 players', players: 4 },
					{ label: 'vs AI', players: 2 },
				],
				action: (players: number) => {
					gameOptions = { type: 'local', playerCount: players, thisPlayer: 1 };
					location.hash = '#game';
				},
			},
			{
				title: 'PLAY REMOTE',
				buttons: [
					{ label: '2 players' },
					{ label: '3 players' },
					{ label: '4 players' },
					{ label: 'TOURNAMENT', hash: '#tournament' },
				],
				action: (_: any, hash?: string) => {
					if (hash) location.hash = hash;
					else void new PlaceholderModal(this.element);
				},
			},
			{
				title: 'TESTING',
				buttons: [
					{ label: 'Test Mode 1' },
					{ label: 'Test Mode 2' },
					{ label: 'Debug Game' },
					{ label: 'Settings' },
				],
				action: () => {
					void new PlaceholderModal(this.element);
				},
			},
		];

		// Create panels dynamically
		for (const panel of panels) {
			const panelEl = document.createElement('div');
			panelEl.className = `flex flex-col items-center justify-center bg-pink-100/20 backdrop-blur-sm border border-pink-200/40 rounded-xl p-6 flex-1 gap-3 transition-all duration-300 hover:bg-pink-100/30 hover:border-pink-300/60`;
			panelsContainer.appendChild(panelEl);

			const titleEl = document.createElement('h2');
			titleEl.textContent = panel.title;
			titleEl.className = 'text-2xl font-extrabold font-ps2p text-white mb-4 text-center';
			titleEl.style.textShadow = `1px 1px 0px #ff79c6, -1px 1px 0px #ff79c6, 1px -1px 0px #ff79c6, -1px -1px 0px #ff79c6`;
			panelEl.appendChild(titleEl);

			// Button container for centering
			const buttonContainer = document.createElement('div');
			buttonContainer.className = 'flex flex-col items-center gap-2 w-full';
			panelEl.appendChild(buttonContainer);

			for (const btn of panel.buttons) {
				const buttonElement = document.createElement('button');
				buttonElement.textContent = btn.label;
				buttonElement.className = 'font-ps2p text-sm text-white bg-pink-500/20 hover:bg-pink-500/40 border border-pink-400/30 hover:border-pink-400/60 rounded-lg px-4 py-2 transition-all duration-200 w-full max-w-48';
				buttonElement.onclick = () => panel.action(btn.players ?? 0, btn.hash);
				buttonContainer.appendChild(buttonElement);
			}
		}
	}
}


		void new Button(
			'Test WebSocket',
			() => {
				webSocket.send(JSON.stringify({
					t: 'test',
					d: 'Test message!'
				}));
			},
			buttonContainer
		);