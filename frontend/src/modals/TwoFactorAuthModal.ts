import type { User } from '../../../shared/schemas/user';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { QRModal } from './QRModal';
import { TextModal } from './TextModal';

export class TwoFactorAuthModal extends Modal {
	state: 'enabled' | 'disabled' = 'disabled';

	constructor(parent: HTMLElement) {
		super(parent);

		// TODO: Placeholder until Wouter new UserSchema is ready
		// const user: User | null = await apiCall('GET', '/users/me', null);
		// this.state = user?.two_factor_enabled ? 'enabled' : 'disabled';
		this.state = 'disabled'; // or 'disabled' based on API response

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
		// TODO: To know if API succeeded, we need to modify apiCall()
		// This is a nice-to-have, not a must-have
		this.destroy();
	}
}
