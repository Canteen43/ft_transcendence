import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button';
import { GameConfig } from '../game/GameConfig';
import { state } from '../utils/State';
import { Modal } from './Modal';
import { TextModal } from './TextModal.js';

export class LocalSetupModal extends Modal {
	private aliasFields: HTMLInputElement[] = [];
	private dropdownContainers: HTMLDivElement[] = [];
	private openDropdownIndex: number | null = null;
	private readonly aiOptions: { label: string; value: string }[] = [
		{ label: 'Circe [AI 1 Hz]', value: '*Circe' },
		{ label: 'Merlin [AI 1.5 Hz]', value: '*Merlin' },
		{ label: 'Morgana [AI 1.9 Hz]', value: '*Morgana' },
		{ label: 'Gandalf [AI 2.5 Hz]', value: '*Gandalf' },
	];
	private powerupCheckboxes: Record<
		'split' | 'stretch' | 'shrink',
		HTMLInputElement
	> | null = null;

	// Store references to all added listeners
	private documentClickHandler: ((e: Event) => void) | null = null;

	constructor(parent: HTMLElement, n: number, type: TournamentType) {
		super(parent);

		if (state.currentModal) {
			state.currentModal.destroy();
			state.currentModal = null;
		}

		if (n < 1 || n > 4) {
			throw new Error('Number of players must be between 1 and 4');
		}

		this.box.classList.add('alias-modal');

		const aliases = [
			sessionStorage.getItem('alias1') ?? '',
			sessionStorage.getItem('alias2') ?? '',
			sessionStorage.getItem('alias3') ?? '',
			sessionStorage.getItem('alias4') ?? '',
		];
		const aliasHints = ['↑←↓→', 'wasd', 'ijkl', '8456'];

		for (let i = 0; i < n; i++) {
			// Create container for title + input
			const containerAlias = document.createElement('div');
			containerAlias.className = 'w-full flex flex-col gap-0.5 m-0';

			// Add tiny title
			const title = document.createElement('label');
			title.className = 'text-[var(--color4)] text-xs m-0';
			title.textContent = `${aliasHints[i]}`;

			const defaultValue = aliases[i] || `player${i + 1}`;
			const row = this.createPlayerRow(i, defaultValue, aliasHints[i]);

			containerAlias.appendChild(title);
			containerAlias.appendChild(row);
			this.box.appendChild(containerAlias);
		}

		this.powerupCheckboxes = this.createPowerupSection();
		new Button('Continue', () => this.handleAlias(), this.box);

		this.documentClickHandler = (e: Event) => {
			const target = e.target as Node;
			// Check if click is outside all dropdowns and their buttons
			const clickedOutside = !this.dropdownContainers.some(
				(dropdown, i) => {
					const button =
						dropdown.previousElementSibling as HTMLElement;
					return (
						dropdown.contains(target) || button?.contains(target)
					);
				}
			);

			if (clickedOutside) {
				this.closeAllDropdowns();
			}
		};
		document.addEventListener('click', this.documentClickHandler);

		this.addEnterListener();

		this.activateFocusTrap();
		this.aliasFields[0].select();
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
			checkbox.className = 'w-5 h-5 accent-[var--(color4)]';

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

	private createPlayerRow(
		index: number,
		defaultValue: string,
		hint: string
	): HTMLDivElement {
		const row = document.createElement('div');
		row.className =
			'flex items-center gap-1 w-full relative text-[var(--color4)]';

		const input = this.createInput(
			defaultValue,
			`username${index + 1}`,
			hint
		);
		row.appendChild(input);
		this.aliasFields.push(input);

		const { button, dropdown } = this.createAISelector(index, input);
		row.appendChild(button);
		row.appendChild(dropdown);
		this.dropdownContainers.push(dropdown);

		return row;
	}

	private createInput(
		defaultValue: string,
		id: string,
		hint: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.id = id;
		input.value = defaultValue;
		input.title = hint;
		input.className =
			'border border-[var(--color3)] p-2 flex-1 text-[var(--color4)] text-sm h-10';
		return input;
	}

	private createAISelector(
		index: number,
		input: HTMLInputElement
	): { button: HTMLButtonElement; dropdown: HTMLDivElement } {
		const button = document.createElement('button');
		button.type = 'button';
		button.className =
			'flex items-center justify-center border border-[var(--color3)] px-2 py-1 text-sm text-[var(--color4)] hover:bg-[var(--color3)]/10 transition-colors h-10 w-10';

		const aiIcon = document.createElement('img');
		aiIcon.src = '/ai.png';
		aiIcon.alt = 'AI options';
		aiIcon.className = 'w-5 h-5';

		button.appendChild(aiIcon);

		const dropdown = document.createElement('div');
		dropdown.className =
			'hidden absolute left-0 top-full mt-1 bg-white border border-[var(--color3)] shadow-lg z-10 overflow-hidden w-full';

		this.aiOptions.forEach(option => {
			const optionButton = document.createElement('button');
			optionButton.type = 'button';
			optionButton.textContent = option.label;
			optionButton.className =
				'w-full px-2 py-0 text-left bg-white hover:bg-[var(--color3)]/10 transition-colors border-none text-[var(--color4)]';

			optionButton.onclick = () => {
				input.value = option.value;
				this.closeAllDropdowns();
				input.focus();
			};

			dropdown.appendChild(optionButton);
		});

		button.onclick = e => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleDropdown(index);
		};

		return { button, dropdown };
	}

	private addEnterListener(): void {
		this.aliasFields.forEach(field => {
			field.onkeydown = (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					this.handleAlias();
				}
			};
		});
	}

	private toggleDropdown(index: number): void {
		const dropdown = this.dropdownContainers[index];
		if (!dropdown) return;

		const isOpen = this.openDropdownIndex === index;
		this.closeAllDropdowns();

		if (!isOpen) {
			dropdown.classList.remove('hidden');
			this.openDropdownIndex = index;
		}
	}

	private closeAllDropdowns(): void {
		this.dropdownContainers.forEach(container => {
			container.classList.add('hidden');
		});
		this.openDropdownIndex = null;
	}

	private handleAlias() {
		for (const field of this.aliasFields) {
			const trimmedValue = field.value.trim();
			if (trimmedValue && trimmedValue.length > 20) {
				new TextModal(this.parent, 'Aliases cannot be > 20 characters.');
				return;
			}
		}
		this.handleLocalGame();
		this.destroy();
	}

	private handleLocalGame(): void {
		const isTournament = sessionStorage.getItem('tournament') === '1';
		this.aliasFields.forEach((field, index) => {
			const alias = field.value.trim() || `Player${index + 1}`;
			sessionStorage.setItem(`alias${index + 1}`, alias);
			if (isTournament) {
				const controlScheme = GameConfig.getDefaultControlScheme(
					(index + 1) as 1 | 2 | 3 | 4
				);
				GameConfig.setPlayerControlScheme(
					(index + 1) as 1 | 2 | 3 | 4,
					controlScheme
				);
				GameConfig.setoriginalAlias(
					(index + 1) as 1 | 2 | 3 | 4,
					alias
				);
			}
		});

		if (!isTournament) {
			for (let i = 1; i <= 4; i++) {
				sessionStorage.removeItem(`alias${i}controls`);
			}
			GameConfig.clearoriginalAliases();
		}

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
	}

	public destroy(): void {

		this.closeAllDropdowns();

		if (this.documentClickHandler) {
			document.removeEventListener('click', this.documentClickHandler);
			this.documentClickHandler = null;
		}

		// Clear DOM references
		this.aliasFields = [];
		this.dropdownContainers = [];
		this.powerupCheckboxes = null;

		super.destroy();
	}
}
