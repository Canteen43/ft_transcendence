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
import { conditionalWarn } from './Logger';
import { GameConfig } from './GameConfig';
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
	private keyState: KeyState = {
		p1Left: false,
		p1Right: false,
		p2Left: false,
		p2Right: false,
		p3Left: false,
		p3Right: false,
		p4Left: false,
		p4Right: false,
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

	private handleKeyDown(e: KeyboardEvent): void {
		const k = e.key;
		if (k === '\\' && !e.repeat) {
			const enabled = Pong3DAI.toggleWizardVisualization();
			console.log(`✨ Wizard traces ${enabled ? 'enabled' : 'disabled'}`);
			return;
		}

		const allowAll = this.shouldAllowFullMasterControl();
		// Player 1: Arrow keys (left/right swapped)
		if (k === 'ArrowRight' || k === 'ArrowUp') this.keyState.p1Left = true;
		if (k === 'ArrowLeft' || k === 'ArrowDown')
			this.keyState.p1Right = true;

		// Player 2: WASD
		if (allowAll && (k === 'a' || k === 'A' || k === 'w' || k === 'W'))
			this.keyState.p2Left = true;
		if (allowAll && (k === 'd' || k === 'D' || k === 's' || k === 'S'))
			this.keyState.p2Right = true;

		// Player 3: IJKL keys
		if (allowAll && (k === 'j' || k === 'J' || k === 'i' || k === 'I'))
			this.keyState.p3Left = true;
		if (allowAll && (k === 'l' || k === 'L' || k === 'k' || k === 'K'))
			this.keyState.p3Right = true;

		// Player 4: Number pad 8456
		if (allowAll && (k === '4' || k === '8')) this.keyState.p4Left = true;
		if (allowAll && (k === '6' || k === '5')) this.keyState.p4Right = true;
	}

	private handleKeyUp(e: KeyboardEvent): void {
		const k = e.key;
		const allowAll = this.shouldAllowFullMasterControl();
		// Player 1: Arrow keys (left/right swapped)
		if (k === 'ArrowRight' || k === 'ArrowUp') this.keyState.p1Left = false;
		if (k === 'ArrowLeft' || k === 'ArrowDown')
			this.keyState.p1Right = false;

		// Player 2: WASD
		if (allowAll && (k === 'a' || k === 'A' || k === 'w' || k === 'W'))
			this.keyState.p2Left = false;
		if (allowAll && (k === 'd' || k === 'D' || k === 's' || k === 'S'))
			this.keyState.p2Right = false;

		// Player 3: IJKL keys
		if (allowAll && (k === 'j' || k === 'J' || k === 'i' || k === 'I'))
			this.keyState.p3Left = false;
		if (allowAll && (k === 'l' || k === 'L' || k === 'k' || k === 'K'))
			this.keyState.p3Right = false;

		// Player 4: Number pad 8456
		if (allowAll && (k === '4' || k === '8')) this.keyState.p4Left = false;
		if (allowAll && (k === '6' || k === '5')) this.keyState.p4Right = false;
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
		// Start with keyboard state
		let currentState = { ...this.keyState };

		// Override with AI input where AI controllers exist
		for (let i = 0; i < 4; i++) {
			if (this.aiControllers[i]) {
				// AI controller exists - we need game state to get AI input
				// For now, return keyboard state; AI will be integrated in getKeyStateWithGameState
				continue;
			}
		}

		return currentState;
	}

	/**
	 * Get key state with AI integration - requires game state for AI decision making
	 */
	public getKeyStateWithGameState(gameState: GameStateForAI): KeyState {
		// Start with keyboard state
		let currentState = { ...this.keyState };

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
				console.log(`🤖 AI Player ${i + 1} input: ${aiInput}`);

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
		// Set network-controlled key state for a specific player
		// This allows remote clients to control paddles through the same input system
		switch (playerIndex) {
			case 0: // Player 1
				this.keyState.p1Left = left;
				this.keyState.p1Right = right;
				break;
			case 1: // Player 2
				this.keyState.p2Left = left;
				this.keyState.p2Right = right;
				break;
			case 2: // Player 3
				this.keyState.p3Left = left;
				this.keyState.p3Right = right;
				break;
			case 3: // Player 4
				this.keyState.p4Left = left;
				this.keyState.p4Right = right;
				break;
		}
	}

	/**
	 * Set up AI controller for a specific player
	 */
	public setAIController(playerIndex: number, config: AIConfig): void {
		if (playerIndex >= 0 && playerIndex < 4) {
			this.aiControllers[playerIndex] = new Pong3DAI(playerIndex, config);
			console.log(
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
			console.log(
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
		console.log('🤖 All AI controllers reset');
	}

	public cleanup(): void {
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
		this.canvas.removeEventListener('dblclick', this.toggleFullscreen);

		// Clean up AI controllers
		this.aiControllers = [null, null, null, null];
	}
}
