export type MobileControlSide = 'left' | 'right';

export interface MobileControlsOptions {
	onStateChange: (side: MobileControlSide, pressed: boolean) => void;
}

/**
 * Simple fixed-position overlay that renders left/right touch zones for mobile play.
 * Uses pointer events so it works with both touch and mouse input.
 */
export class MobileControlsOverlay {
	private root: HTMLDivElement;
	private leftButton: HTMLButtonElement;
	private rightButton: HTMLButtonElement;
	private options: MobileControlsOptions;
	private activePointerIds = new Map<number, MobileControlSide>();

	constructor(options: MobileControlsOptions) {
		this.options = options;
		this.root = document.createElement('div');
		this.root.style.position = 'fixed';
		this.root.style.left = '0';
		this.root.style.right = '0';
		this.root.style.bottom = '2vh';
		this.root.style.display = 'flex';
		this.root.style.justifyContent = 'space-between';
		this.root.style.padding = '0 8vw';
		this.root.style.pointerEvents = 'none';
		this.root.style.zIndex = '9999';

		this.leftButton = this.createButton('◀', 'left');
		this.rightButton = this.createButton('▶', 'right');

		this.root.appendChild(this.leftButton);
		this.root.appendChild(this.rightButton);
		document.body.appendChild(this.root);
	}

	private createButton(label: string, side: MobileControlSide): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		button.style.width = '18vw';
		button.style.maxWidth = '120px';
		button.style.aspectRatio = '1 / 1';
		button.style.borderRadius = '50%';
		button.style.border = 'none';
		button.style.background =
			'rgba(0, 0, 0, 0.35)';
		button.style.color = '#fff';
		button.style.fontSize = 'clamp(24px, 6vw, 36px)';
		button.style.fontWeight = '600';
		button.style.pointerEvents = 'auto';
		button.style.touchAction = 'none';
		button.style.display = 'flex';
		button.style.alignItems = 'center';
		button.style.justifyContent = 'center';
		button.style.backdropFilter = 'blur(6px)';

		const pressHandler = (event: PointerEvent) => {
			event.preventDefault();
			button.setPointerCapture(event.pointerId);
			this.activePointerIds.set(event.pointerId, side);
			this.setPressedStyle(button, true);
			this.options.onStateChange(side, true);
		};

		const releaseHandler = (event: PointerEvent) => {
			event.preventDefault();
			this.releasePointer(event.pointerId, side, button);
		};

		button.addEventListener('pointerdown', pressHandler);
		button.addEventListener('pointerup', releaseHandler);
		button.addEventListener('pointercancel', releaseHandler);
		button.addEventListener('pointerout', releaseHandler);
		button.addEventListener('lostpointercapture', releaseHandler);

		return button;
	}

	private releasePointer(
		pointerId: number,
		side: MobileControlSide,
		button: HTMLButtonElement
	): void {
		const trackedSide = this.activePointerIds.get(pointerId);
		if (trackedSide !== side) {
			return;
		}
		this.activePointerIds.delete(pointerId);
		if (![...this.activePointerIds.values()].includes(side)) {
			this.setPressedStyle(button, false);
			this.options.onStateChange(side, false);
		}
	}

	private setPressedStyle(button: HTMLButtonElement, pressed: boolean): void {
		if (pressed) {
			button.style.transform = 'scale(0.92)';
			button.style.background = 'rgba(0, 0, 0, 0.55)';
		} else {
			button.style.transform = 'scale(1)';
			button.style.background = 'rgba(0, 0, 0, 0.35)';
		}
	}

	public destroy(): void {
		this.activePointerIds.clear();
		this.leftButton.remove();
		this.rightButton.remove();
		if (this.root.parentNode) {
			this.root.parentNode.removeChild(this.root);
		}
	}
}

export function isMobileInputEnabled(): boolean {
	try {
		return window.sessionStorage?.getItem('mobile') === 'true';
	} catch (_err) {
		return false;
	}
}
