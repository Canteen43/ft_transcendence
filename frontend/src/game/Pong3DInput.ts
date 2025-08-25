export interface KeyState {
	p1Left: boolean;
	p1Right: boolean;
	p2Left: boolean;
	p2Right: boolean;
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
	};

	private canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		window.addEventListener('keydown', e => this.handleKeyDown(e));
		window.addEventListener('keyup', e => this.handleKeyUp(e));
		this.canvas.addEventListener('dblclick', () => this.toggleFullscreen());
	}

	private handleKeyDown(e: KeyboardEvent): void {
		const k = e.key;
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p1Left = true;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p1Right = true;

		if (k === 'ArrowLeft' || k === 'ArrowUp') this.keyState.p2Left = true;
		if (k === 'ArrowRight' || k === 'ArrowDown') this.keyState.p2Right = true;
	}

	private handleKeyUp(e: KeyboardEvent): void {
		const k = e.key;
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p1Left = false;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p1Right = false;

		if (k === 'ArrowLeft' || k === 'ArrowUp') this.keyState.p2Left = false;
		if (k === 'ArrowRight' || k === 'ArrowDown') this.keyState.p2Right = false;
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
