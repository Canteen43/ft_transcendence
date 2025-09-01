import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { LoginButton } from '../misc/LoginButton';
import { PlaceholderModal } from '../modals/PlaceholderModal';

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
				void new PlaceholderModal(this.element);
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
			'To TournamentScreen',
			() => {
				location.hash = '#tournament';
			},
			buttonContainer
		);
	}
}
