import { state } from '../utils/State';

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
	private leftZone: HTMLDivElement;
	private rightZone: HTMLDivElement;
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
		this.root.style.alignItems = 'flex-end';
		this.root.style.padding = '0 8vw';
		this.root.style.pointerEvents = 'none';
		this.root.style.userSelect = 'none';
		this.root.style.setProperty('-webkit-user-select', 'none');
		this.root.style.setProperty('-webkit-touch-callout', 'none');
		this.root.style.zIndex = '9999';

		const leftControl = this.createTouchZone('◀', 'left');
		this.leftZone = leftControl.zone;
		this.leftButton = leftControl.button;

		const rightControl = this.createTouchZone('▶', 'right');
		this.rightZone = rightControl.zone;
		this.rightButton = rightControl.button;

		this.root.appendChild(this.leftZone);
		this.root.appendChild(this.rightZone);
		document.body.appendChild(this.root);
	}

	private createTouchZone(
		label: string,
		side: MobileControlSide
	): { zone: HTMLDivElement; button: HTMLButtonElement } {
		const zone = document.createElement('div');
		zone.style.position = 'relative';
		zone.style.display = 'flex';
		zone.style.alignItems = 'center';
		zone.style.justifyContent = 'center';
		zone.style.pointerEvents = 'none';
		zone.style.overflow = 'visible';
		zone.style.width = '18vw';
		zone.style.maxWidth = '120px';
		zone.style.height = '18vw';
		zone.style.maxHeight = '120px';
		zone.style.userSelect = 'none';
		zone.style.setProperty('-webkit-user-select', 'none');
		zone.style.setProperty('-webkit-touch-callout', 'none');

		const hitArea = document.createElement('div');
		hitArea.style.position = 'absolute';
		hitArea.style.left = '50%';
		hitArea.style.top = '50%';
		hitArea.style.width = '36vw';
		hitArea.style.maxWidth = '240px';
		hitArea.style.height = '36vw';
		hitArea.style.maxHeight = '240px';
		hitArea.style.transform = 'translate(-50%, -50%)';
		hitArea.style.pointerEvents = 'auto';
		hitArea.style.touchAction = 'none';
		hitArea.style.userSelect = 'none';
		hitArea.style.setProperty('-webkit-user-select', 'none');
		hitArea.style.setProperty('-webkit-touch-callout', 'none');

		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		button.style.width = '18vw';
		button.style.maxWidth = '120px';
		button.style.aspectRatio = '1 / 1';
		button.style.borderRadius = '50%';
		button.style.border = 'none';
		button.style.background = 'rgba(0, 0, 0, 0.35)';
		button.style.color = '#fff';
		button.style.fontSize = 'clamp(24px, 6vw, 36px)';
		button.style.fontWeight = '600';
		button.style.pointerEvents = 'none';
		button.style.position = 'relative';
		button.style.zIndex = '1';
		button.style.display = 'flex';
		button.style.alignItems = 'center';
		button.style.justifyContent = 'center';
		button.style.backdropFilter = 'blur(6px)';
		button.style.userSelect = 'none';
		button.style.setProperty('-webkit-user-select', 'none');
		button.style.setProperty('-webkit-touch-callout', 'none');

		const pressHandler = (event: PointerEvent) => {
			event.preventDefault();
			hitArea.setPointerCapture(event.pointerId);
			this.activePointerIds.set(event.pointerId, side);
			this.setPressedStyle(button, true);
			this.options.onStateChange(side, true);
		};

		const releaseHandler = (event: PointerEvent) => {
			event.preventDefault();
			this.releasePointer(event.pointerId, side, button);
		};

		hitArea.addEventListener('pointerdown', pressHandler);
		hitArea.addEventListener('pointerup', releaseHandler);
		hitArea.addEventListener('pointercancel', releaseHandler);
		hitArea.addEventListener('pointerout', releaseHandler);
		hitArea.addEventListener('lostpointercapture', releaseHandler);

		zone.appendChild(hitArea);
		zone.appendChild(button);

		return { zone, button };
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
		this.leftZone.remove();
		this.rightZone.remove();
		if (this.root.parentNode) {
			this.root.parentNode.removeChild(this.root);
		}
	}
}

export function isMobileInputEnabled(): boolean {
	try {
		return state.isMobile === true;
	} catch (_err) {
		return false;
	}
}
