import { TextModal } from '../modals/TextModal';
import { TwoFactorAuthModal } from '../modals/TwoFactorAuthModal';
import { Button } from './Button';

export class TwoFactAuthButton extends Button {
	private parent: HTMLElement;
	constructor(parent: HTMLElement) {
		super('2FA', () => this.readyClicked(), parent);
		this.parent = parent;
		this.element.className +=
			'fixed top-4 right-72 w-32 sm:w-48 md:w-60 z-10 text-center truncate';
	}

	private readyClicked() {
		if (sessionStorage.getItem('token')) {
			new TwoFactorAuthModal(this.parent);
		} else {
			new TextModal(this.parent, 'You must be logged access 2FA.');
		}
	}
}
