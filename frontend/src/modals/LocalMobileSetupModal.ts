import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button';
import { GameConfig } from '../game/GameConfig';
import { state } from '../utils/State';
import { Modal } from './Modal';

export class LocalMobileSetupModal extends Modal {
	private playerNameInput: HTMLInputElement;
	private aiSelects: HTMLSelectElement[] = [];
	private readonly aiOptions: { label: string; value: string }[] = [
		{ label: 'Circe', value: '*Circe' },
		{ label: 'Merlin', value: '*Merlin' },
		{ label: 'Morgana', value: '*Morgana' },
		{ label: 'Gandalf', value: '*Gandalf' },
	];
	private powerupCheckboxes: Record<
		'split' | 'stretch' | 'shrink',
		HTMLInputElement
	> | null = null;

	constructor(parent: HTMLElement, n: number, type: TournamentType) {
		super(parent);

		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;

		if (n < 1 || n > 4) {
			throw new Error('Number of players must be between 1 and 4');
		}
		this.box.classList.add('alias-modal');

		this.playerNameInput = this.createPlayerInput();
		this.createAIOpponentsSection(n);
		this.powerupCheckboxes = this.createPowerupSection();

		new Button('Continue', () => this.handleContinue(n), this.box);

		this.addEnterListener(n);

		// Focus player name input
		this.activateFocusTrap();
		this.playerNameInput.select();
	}

	private createPlayerInput(): HTMLInputElement {
		const alias = sessionStorage.getItem('alias1');

		const container = document.createElement('div');
		container.className = 'w-full flex flex-col gap-0.5 m-0';

		const input = document.createElement('input');
		input.value = alias ? alias : 'alias';
		input.className =
			'border border-[var(--color3)] p-2 text-[var(--color4)] text-sm h-10 w-full';
		container.appendChild(input);
		this.box.appendChild(container);

		return input;
	}

	private createAIOpponentsSection(n: number): void {
		const container = document.createElement('div');
		container.className = 'w-full flex flex-col gap-2 mb-3';

		for (let i = 1; i < n; i++) {
			const aiContainer = document.createElement('div');
			aiContainer.className = 'flex flex-col gap-1';

			const label = document.createElement('label');
			label.className = 'text-xs text-[var(--color4)]';

			const select = document.createElement('select');
			select.className =
				'border border-[var(--color3)] p-2 text-[var(--color4)] text-sm h-10 w-full';

			// Add AI options
			this.aiOptions.forEach(option => {
				const optionElement = document.createElement('option');
				optionElement.value = option.value;
				optionElement.textContent = option.label;
				select.appendChild(optionElement);
			});

			// Set default AIs
			select.value = this.aiOptions[i - 1].value;

			this.aiSelects.push(select);

			aiContainer.appendChild(label);
			aiContainer.appendChild(select);
			container.appendChild(aiContainer);
		}

		this.box.appendChild(container);
	}

	private createPowerupSection(): Record<
		'split' | 'stretch' | 'shrink',
		HTMLInputElement
	> {
		const containerPU = document.createElement('div');
		containerPU.className = 'w-full flex flex-col gap-1.5 mt-1';

		const title = document.createElement('h2');
		title.textContent = 'PowerUps';
		title.className = 'text-lg font-bold text-[var(--color4)]';
		containerPU.appendChild(title);

		const list = document.createElement('div');
		list.className = 'flex flex-col gap-1 pb-1';
		containerPU.appendChild(list);

		const checkboxMap: Record<
			'split' | 'stretch' | 'shrink',
			HTMLInputElement
		> = {} as any;
		const powerups: {
			key: 'split' | 'stretch' | 'shrink';
			label: string;
		}[] = [
			{ key: 'split', label: 'Ball Split' },
			{ key: 'stretch', label: 'Paddle Stretch' },
			{ key: 'shrink', label: 'Paddle Shrink' },
		];

		powerups.forEach(({ key, label }) => {
			const row = document.createElement('label');
			row.className =
				'flex items-center gap-2.5 text-base text-[var(--color4)]';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = sessionStorage.getItem(key) === '1';
			checkbox.className = 'w-5 h-5 accent-[var(--color4)]';

			const span = document.createElement('span');
			span.textContent = label;
			span.className = 'text-sm font-medium text-[var(--color4)]';

			row.appendChild(checkbox);
			row.appendChild(span);
			list.appendChild(row);

			checkboxMap[key] = checkbox;
		});

		this.box.appendChild(containerPU);
		return checkboxMap;
	}

	private addEnterListener(n: number): void {
		this.playerNameInput.onkeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.handleContinue(n);
			}
		};

		this.aiSelects.forEach(select => {
			select.onkeydown = (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					this.handleContinue(n);
				}
			};
		});
	}

	private handleContinue(n: number): void {
		const isTournament = sessionStorage.getItem('tournament') === '1';

		// Save player 1 name
		const playerName = this.playerNameInput.value.trim() || 'Player1';
		sessionStorage.setItem('alias1', playerName);

		if (isTournament) {
			const controlScheme = GameConfig.getDefaultControlScheme(1);
			GameConfig.setPlayerControlScheme(1, controlScheme);
			GameConfig.setoriginalAlias(1, playerName);
		}

		// Save AI opponents
		this.aiSelects.forEach((select, index) => {
			const aiName = select.value;
			sessionStorage.setItem(`alias${index + 2}`, aiName);

			if (isTournament) {
				const controlScheme = GameConfig.getDefaultControlScheme(
					(index + 2) as 2 | 3 | 4
				);
				GameConfig.setPlayerControlScheme(
					(index + 2) as 2 | 3 | 4,
					controlScheme
				);
				GameConfig.setoriginalAlias((index + 2) as 2 | 3 | 4, aiName);
			}
		});

		// Clear unused slots
		for (let i = n + 1; i <= 4; i++) {
			sessionStorage.removeItem(`alias${i}`);
		}

		if (!isTournament) {
			for (let i = 1; i <= 4; i++) {
				sessionStorage.removeItem(`alias${i}controls`);
			}
			GameConfig.clearoriginalAliases();
		}

		// Save powerups
		if (this.powerupCheckboxes) {
			sessionStorage.setItem(
				'split',
				this.powerupCheckboxes.split.checked ? '1' : '0'
			);
			sessionStorage.setItem(
				'stretch',
				this.powerupCheckboxes.stretch.checked ? '1' : '0'
			);
			sessionStorage.setItem(
				'shrink',
				this.powerupCheckboxes.shrink.checked ? '1' : '0'
			);
		}

		location.hash = '#game';
		this.destroy();
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}

		this.aiSelects = [];
		this.powerupCheckboxes = null;

		super.destroy();
	}
}
