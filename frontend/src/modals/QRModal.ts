import QRCode from 'qrcode';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';

export class QRModal extends Modal {
	private inputField!: HTMLInputElement; // keep reference to input

	constructor(parent: HTMLElement, code: string) {
		super(parent);

		this.addMessage();
		this.addQRCode(code);
		this.addInputField();
		this.addEnableButton();
	}

	private addMessage() {
		const message = document.createElement('p');
		message.textContent =
			'Scan this QR code with your authenticator app.\n' +
			'The app will generate codes.\n' +
			'Enter the code below to enable 2FA.';
		message.className =
			'text-center text-sm sm:text-base  text-gray-800 whitespace-pre-line';
		this.box.appendChild(message);
	}

	private async addQRCode(code: string) {
		const qrCode = document.createElement('img');
		qrCode.className = 'mx-auto my-4';
		this.box.appendChild(qrCode);
		qrCode.src = code;
	}

	private addInputField() {
		this.inputField = document.createElement('input');
		this.inputField.type = 'text';
		this.inputField.placeholder = 'Enter code';
		this.inputField.className =
			'block w-full mt-2 p-2 border rounded-md text-center text-sm sm:text-base ';
		this.box.appendChild(this.inputField);
		this.inputField.focus();
	}

	private addEnableButton() {
		new Button('Enable 2FA', () => this.handleSubmit(), this.box);
	}

	private async handleSubmit() {
		const value = this.inputField.value.trim();
		if (!value) {
			return;
		}
		const { data: payload, error } = await apiCall(
			'POST',
			`/users/2fa/enable/verify`,
			undefined,
			value
		);
		if (error) {
			console.warn('Enable 2FA failed:', error);
			this.destroy();
			return;
		} else {
			console.info('2FA successfully enabled');
		}
		this.destroy();
	}
}
