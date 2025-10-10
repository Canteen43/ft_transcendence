/**
 * Pong3DInput - Handles keyboard input for up to 4 players with AI integration
 *
 * Key Bindings:
 * - Player 1: Arrow Right/Up (left) Arrow Left/Down (right)
 * - Player 2: A/W (left) D/S (right)
 * - Player 3: J/I (left) L/K (right)
 * - Player 4: 4/8 (left) 6/5 (right)
 *
 * AI Integration:
 * - Players with names starting with '*' use AI control
 * - AI provides the same input interface as human players
 *
 * Additional Controls:
 * - Double-click canvas: Toggle fullscreen
 */
import { conditionalLog, conditionalWarn } from './Logger';
import { ControlScheme, GameConfig } from './GameConfig';
import { AIConfig, AIInput, GameStateForAI, Pong3DAI } from './pong3DAI';

export interface KeyState {
	p1Left: boolean;
	p1Right: boolean;
	p2Left: boolean;
	p2Right: boolean;
	p3Left: boolean;
	p3Right: boolean;
	p4Left: boolean;
	p4Right: boolean;
}

export interface InputHandlers {
	onKeyDown: (e: KeyboardEvent) => void;
	onKeyUp: (e: KeyboardEvent) => void;
	onToggleFullscreen: () => void;
}

export class Pong3DInput {
	private controlState: Record<ControlScheme, { left: boolean; right: boolean }> = {
		arrows: { left: false, right: false },
		wasd: { left: false, right: false },
		ijkl: { left: false, right: false },
		'8456': { left: false, right: false },
	};

	private canvas: HTMLCanvasElement;
	private aiControllers: (Pong3DAI | null)[] = [null, null, null, null];

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		// Bind event handlers to 'this' instance to ensure correct context
		// and allow them to be removed correctly in cleanup.
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleKeyUp = this.handleKeyUp.bind(this);
		this.toggleFullscreen = this.toggleFullscreen.bind(this);
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('keyup', this.handleKeyUp);
		this.canvas.addEventListener('dblclick', this.toggleFullscreen);
	}

	private isLocalTournament(): boolean {
		return GameConfig.isLocalTournament();
	}

	private shouldFlipP1Controls(): boolean {
		if (GameConfig.isRemoteMode()) {
			return GameConfig.getThisPlayer() === 1;
		}
		return (
			this.isLocalTournament() &&
			GameConfig.getPlayerCount() === 3 &&
			!GameConfig.isCurrentAliasSeed(1)
		);
	}

	private updateControlState(
		scheme: ControlScheme,
		side: 'left' | 'right',
		value: boolean,
		requiresFullControl: boolean,
		allowAll: boolean
	): void {
		if (requiresFullControl && !allowAll) return;
		const state = this.controlState[scheme];
		if (!state) return;
		if (state[side] === value) return;
		state[side] = value;
	}

	private processKeyInput(
		key: string,
		value: boolean,
		allowAll: boolean
	): void {
		const normalized = key.length === 1 ? key.toLowerCase() : key;

		if (key === 'ArrowRight' || key === 'ArrowUp') {
			this.updateControlState('arrows', 'right', value, false, allowAll);
		}
		if (key === 'ArrowLeft' || key === 'ArrowDown') {
			this.updateControlState('arrows', 'left', value, false, allowAll);
		}

		if (normalized === 'a' || normalized === 'w') {
			this.updateControlState('wasd', 'left', value, true, allowAll);
		}
		if (normalized === 'd' || normalized === 's') {
			this.updateControlState('wasd', 'right', value, true, allowAll);
		}

		if (normalized === 'j' || normalized === 'i') {
			this.updateControlState('ijkl', 'left', value, true, allowAll);
		}
		if (normalized === 'l' || normalized === 'k') {
			this.updateControlState('ijkl', 'right', value, true, allowAll);
		}

		if (normalized === '4' || normalized === '8') {
			this.updateControlState('8456', 'left', value, true, allowAll);
		}
		if (normalized === '6' || normalized === '5') {
			this.updateControlState('8456', 'right', value, true, allowAll);
		}
	}

	private getControlAssignments(): ControlScheme[] {
		if (!this.isLocalTournament()) {
			return [
				GameConfig.getDefaultControlScheme(1),
				GameConfig.getDefaultControlScheme(2),
				GameConfig.getDefaultControlScheme(3),
				GameConfig.getDefaultControlScheme(4),
			];
		}
		return [
			GameConfig.getPlayerControlScheme(1),
			GameConfig.getPlayerControlScheme(2),
			GameConfig.getPlayerControlScheme(3),
			GameConfig.getPlayerControlScheme(4),
		];
	}

	private composeKeyState(): KeyState {
		const assignments = this.getControlAssignments();
		const flipP1 = this.shouldFlipP1Controls();
		const fallback = (index: number): ControlScheme =>
			assignments[index] ??
			GameConfig.getDefaultControlScheme((index + 1) as 1 | 2 | 3 | 4);

		const resolve = (index: number, side: 'left' | 'right'): boolean => {
			const scheme = fallback(index);
			const state = this.controlState[scheme];
			if (!state) return false;
			if (index === 0 && flipP1) {
				// Paddle 1 controls are mirrored so left/right swap regardless of scheme
				return state[side === 'left' ? 'right' : 'left'];
			}
			return state[side];
		};

		return {
			p1Left: resolve(0, 'left'),
			p1Right: resolve(0, 'right'),
			p2Left: resolve(1, 'left'),
			p2Right: resolve(1, 'right'),
			p3Left: resolve(2, 'left'),
			p3Right: resolve(2, 'right'),
			p4Left: resolve(3, 'left'),
			p4Right: resolve(3, 'right'),
		};
	}

	private handleKeyDown(e: KeyboardEvent): void {
		const key = e.key;
		if (key === '\\' && !e.repeat) {
			const enabled = Pong3DAI.toggleWizardVisualization();
			conditionalLog(`✨ Wizard traces ${enabled ? 'enabled' : 'disabled'}`);
			return;
		}

		const allowAll = this.shouldAllowFullMasterControl();
		this.processKeyInput(key, true, allowAll);
	}

	private handleKeyUp(e: KeyboardEvent): void {
		const key = e.key;
		const allowAll = this.shouldAllowFullMasterControl();
		this.processKeyInput(key, false, allowAll);
	}

	private shouldAllowFullMasterControl(): boolean {
		if (!GameConfig.isRemoteMode()) {
			return true;
		}
		const isMaster = GameConfig.getThisPlayer() === 1;
		if (!isMaster) {
			return true; // clients control only their paddle via other handlers
		}
		return GameConfig.isMasterControlEnabled();
	}

	private toggleFullscreen(): void {
		if (!document.fullscreenElement) {
			this.canvas
				.requestFullscreen()
				.catch(err => conditionalWarn('Fullscreen failed:', err));
		} else {
			document.exitFullscreen();
		}
	}

	public getKeyState(): KeyState {
		return this.composeKeyState();
	}

	/**
	 * Get key state with AI integration - requires game state for AI decision making
	 */
	public getKeyStateWithGameState(gameState: GameStateForAI): KeyState {
		const currentState = this.composeKeyState();

		// Override with AI input where AI controllers exist
		const playerKeys = [
			{ left: 'p1Left', right: 'p1Right' },
			{ left: 'p2Left', right: 'p2Right' },
			{ left: 'p3Left', right: 'p3Right' },
			{ left: 'p4Left', right: 'p4Right' },
		];

		for (let i = 0; i < 4; i++) {
			if (this.aiControllers[i]) {
				const aiInput = this.aiControllers[i]!.update(gameState);
				if (GameConfig.isDebugLoggingEnabled()) {
					conditionalLog(`🤖 AI Player ${i + 1} input: ${aiInput}`);
				}

				// Override keyboard input with AI input
				currentState[playerKeys[i].left as keyof KeyState] =
					aiInput === AIInput.LEFT;
				currentState[playerKeys[i].right as keyof KeyState] =
					aiInput === AIInput.RIGHT;
			}
		}

		return currentState;
	}

	public setNetworkKeyState(
		playerIndex: number,
		left: boolean,
		right: boolean
	): void {
		const assignments = this.getControlAssignments();
		const index = Math.max(0, Math.min(3, playerIndex));
		const scheme =
			assignments[index] ??
			GameConfig.getDefaultControlScheme((index + 1) as 1 | 2 | 3 | 4);
		const state = this.controlState[scheme];
		if (!state) return;
		if (index === 0 && this.shouldFlipP1Controls()) {
			state.left = right;
			state.right = left;
		} else {
			state.left = left;
			state.right = right;
		}
	}

	/**
	 * Set up AI controller for a specific player
	 */
	public setAIController(playerIndex: number, config: AIConfig): void {
		if (playerIndex >= 0 && playerIndex < 4) {
			this.aiControllers[playerIndex] = new Pong3DAI(playerIndex, config);
			conditionalLog(
				`🤖 AI controller set up for player ${playerIndex + 1}`
			);
		}
	}

	/**
	 * Remove AI controller for a specific player
	 */
	public removeAIController(playerIndex: number): void {
		if (playerIndex >= 0 && playerIndex < 4) {
			this.aiControllers[playerIndex] = null;
			conditionalLog(
				`🤖 AI controller removed for player ${playerIndex + 1}`
			);
		}
	}

	/**
	 * Check if a player has AI control
	 */
	public hasAIController(playerIndex: number): boolean {
		return (
			playerIndex >= 0 &&
			playerIndex < 4 &&
			this.aiControllers[playerIndex] !== null
		);
	}

	/**
	 * Get AI controller config for a player
	 */
	public getAIControllerConfig(playerIndex: number): AIConfig | null {
		if (this.hasAIController(playerIndex)) {
			return this.aiControllers[playerIndex]!.getConfig();
		}
		return null;
	}

	/**
	 * Reset all AI controllers (useful when restarting games)
	 */
	public resetAIControllers(): void {
		this.aiControllers.forEach(ai => ai?.reset());
		conditionalLog('🤖 All AI controllers reset');
	}

	public cleanup(): void {
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
		this.canvas.removeEventListener('dblclick', this.toggleFullscreen);

		// Clean up AI controllers
		this.aiControllers = [null, null, null, null];
		Object.values(this.controlState).forEach(state => {
			state.left = false;
			state.right = false;
		});
	}
}
