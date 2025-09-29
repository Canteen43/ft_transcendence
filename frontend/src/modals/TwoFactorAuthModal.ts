import type { User } from '../../../shared/schemas/user';
import { UserSchema } from '../../../shared/schemas/user';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { QRModal } from './QRModal';
import { TextModal } from './TextModal';

export class TwoFactorAuthModal extends Modal {
	state: 'enabled' | 'disabled' = 'disabled';
	username: string | null = null;

	constructor(parent: HTMLElement) {
		super(parent);

		// Using init function to allow async/await
		this.init();
	}

	private async init(): Promise<void> {
		this.username = sessionStorage.getItem('username');
		if (!this.username) {
			console.warn(
				'Quitting 2FA modal because no username found. This error should have been caught earlier.'
			);
			this.destroy();
			return;
		}
		const { data: user, error } = await apiCall<User>(
			'GET',
			`/users/login/${this.username}`,
			UserSchema
		);
		if (error) {
			console.warn(
				'Quitting 2FA modal because user fetch failed:',
				error
			);
			this.destroy();
			return;
		}
		this.state = user!.two_factor_enabled ? 'enabled' : 'disabled';

		// Option to manually set state for testing;
		// this.state = 'disabled';

		// Create text element
		let textElement = document.createElement('p');
		textElement.textContent = `Two-Factor Authentication is currently ${this.state}.`;
		textElement.className = 'text-center text-lg text-gray-800';
		this.box.appendChild(textElement);

		if (this.state === 'disabled') {
			void new Button(
				'Generate QR',
				this.getTwoFactorAuthCode.bind(this),
				this.box
			);
		} else {
			void new Button(
				'Disable 2FA',
				this.disable2FA.bind(this),
				this.box
			);
		}
	}

	private getTwoFactorAuthCode(): void {
		// TODO: Placeholder until Wouters Schema and API are ready
		// someType = apiCall('POST', '/users/2fa/enable', someSchema);
		let returnCode: string | null =
			'otpauth://totp/Transcendence:karl@example.com?' +
			'secret=JBSWY3DPEHPK3PXX&' +
			'issuer=TestApp&' +
			'digits=6&' +
			'period=30';
		if (!returnCode) {
			new TextModal(this.parent, 'Failed to generate QR code.');
			this.destroy();
			return;
		}
		new QRModal(this.parent, returnCode);
		this.destroy();
	}

	private disable2FA(): void {
		// TODO: Placeholder until Wouters API is ready
		// apiCall('POST', '/users/2fa/disable');
		// TODO: apiCall() can be used to check for success/failure
		this.destroy();
	}
}
