/**
 * Pong3DInput - Handles keyboard input for up to 4 players
 * 
 * Key Bindings:
 * - Player 1: Arrow Right/Up (left) Arrow Left/Down (right)
 * - Player 2: A/W (left) D/S (right)  
 * - Player 3: J/I (left) L/K (right)
 * - Player 4: 4/8 (left) 6/5 (right)
 * 
 * Additional Controls:
 * - Double-click canvas: Toggle fullscreen
 */

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
		// Player 1: Arrow keys (left/right swapped)
		if (k === 'ArrowRight' || k === 'ArrowUp') this.keyState.p1Left = true;
		if (k === 'ArrowLeft' || k === 'ArrowDown') this.keyState.p1Right = true;

		// Player 2: WASD
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p2Left = true;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p2Right = true;

		// Player 3: IJKL keys
		if (k === 'j' || k === 'J' || k === 'i' || k === 'I') this.keyState.p3Left = true;
		if (k === 'l' || k === 'L' || k === 'k' || k === 'K') this.keyState.p3Right = true;

		// Player 4: Number pad 8456
		if (k === '4' || k === '8') this.keyState.p4Left = true;
		if (k === '6' || k === '5') this.keyState.p4Right = true;
	}

	private handleKeyUp(e: KeyboardEvent): void {
		const k = e.key;
		// Player 1: Arrow keys (left/right swapped)
		if (k === 'ArrowRight' || k === 'ArrowUp') this.keyState.p1Left = false;
		if (k === 'ArrowLeft' || k === 'ArrowDown') this.keyState.p1Right = false;

		// Player 2: WASD
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p2Left = false;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p2Right = false;

		// Player 3: IJKL keys
		if (k === 'j' || k === 'J' || k === 'i' || k === 'I') this.keyState.p3Left = false;
		if (k === 'l' || k === 'L' || k === 'k' || k === 'K') this.keyState.p3Right = false;

		// Player 4: Number pad 8456
		if (k === '4' || k === '8') this.keyState.p4Left = false;
		if (k === '6' || k === '5') this.keyState.p4Right = false;
	}

	private toggleFullscreen(): void {
		if (!document.fullscreenElement) {
			this.canvas.requestFullscreen().catch(err => console.warn('Fullscreen failed:', err));
		} else {
			document.exitFullscreen();
		}
	}

	public getKeyState(): KeyState {
		return { ...this.keyState };
	}

	public cleanup(): void {
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('keyup', this.handleKeyUp);
		this.canvas.removeEventListener('dblclick', this.toggleFullscreen);
	}
}
