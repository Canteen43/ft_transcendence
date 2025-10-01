import { z } from 'zod';
import type { QRCode, User } from '../../../shared/schemas/user';
import { QRCodeSchema, UserSchema } from '../../../shared/schemas/user';
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
		// this.state = 'enabled';

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

	private async getTwoFactorAuthCode(): Promise<void> {
		const { data: qrCode, error } = await apiCall<QRCode>(
			'POST',
			'/users/2fa/enable',
			QRCodeSchema
		);
		if (error || !qrCode) {
			console.warn('Code URI fetch failed:', qrCode, error);
			this.destroy();
			return;
		}
		new QRModal(this.parent, qrCode.data);
		this.destroy();
	}

	private async disable2FA(): Promise<void> {
		const { data: payload, error } = await apiCall(
			'POST',
			`/users/2fa/disable`
		);
		if (error) {
			console.warn('Disable 2FA failed:', error);
			this.destroy();
			return;
		} else {
			console.info('2FA successfully disabled');
		}
		this.destroy();
	}
}
