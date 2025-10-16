import { z } from 'zod';
import type { AuthResponse } from '../../../shared/schemas/user.ts';
import {
	AuthRequestSchema,
	AuthResponseSchema,
} from '../../../shared/schemas/user.ts';
import { Button } from '../buttons/Button.ts';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper.ts';
import { Modal } from './Modal.ts';
import { RegisterModal } from './RegisterModal';
import { TextModal } from './TextModal';

export class LoginModal extends Modal {
	private handleEnter: (e: KeyboardEvent) => void;
	private UsernameField: HTMLInputElement;
	private PasswordField: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;

		// Create form
		const form = document.createElement('form');
		form.className = 'flex flex-col gap-4';
		this.box.appendChild(form);

		this.UsernameField = this.myCreateInput(
			'text',
			'username',
			'Enter your username',
			form,
			'username'
		);
		this.PasswordField = this.myCreateInput(
			'password',
			'password',
			'Enter your password',
			form,
			'current-password'
		);
		new Button('Login', () => this.handleLogin(), this.box);
		this.createLinks(parent);

		this.UsernameField.focus();
		this.UsernameField.select();

		this.handleEnter = (e: KeyboardEvent) => {
			if (e.key == 'Enter') {
				e.preventDefault();
				this.handleLogin();
			}
		};

		this.addEnterListener();
	}

	private addEnterListener() {
		this.UsernameField.addEventListener('keydown', this.handleEnter);
		this.PasswordField.addEventListener('keydown', this.handleEnter);
	}

	private async handleLogin() {
		const username = this.UsernameField.value.trim();
		const password = this.PasswordField.value.trim();

		const requestData = { login: username, password: password };

		const parseResult = AuthRequestSchema.safeParse(requestData);
		if (!parseResult.success) {
			new TextModal(this.parent, 'Invalid login format');
			console.error(
				'Request validation failed:',
				z.treeifyError(parseResult.error)
			);
			return;
		}

		const { data: authData, error } = await apiCall(
			'POST',
			'/users/auth',
			AuthResponseSchema,
			requestData
		);
		if (error) {
			console.error('Registration error:', error);
			const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
			this.errorModal(message);
			return;
		}
		if (!authData) {
			new TextModal(this.parent, 'Login unsuccessful');
			return;
		}
		if (authData.two_factor_enabled) {
			this.showCodeInputView(authData);
			return;
		}
		console.log('Login successful for: ', authData.login);
		sessionStorage.setItem('username', username);
		this.login(authData.token, authData.user_id);

		this.destroy();
	}

	private errorModal(message: string) {
		const modal = new TextModal(this.parent, message);
		modal.onClose = () => {
			this.UsernameField.focus();
			this.UsernameField.select();
		};
	}

	private login(token: string, id: string) {
		sessionStorage.setItem('token', token);
		sessionStorage.setItem('userID', id);
		this.destroy();
		webSocket.open();
		console.info('Login successful - auth valid');
	}

	private myCreateInput(
		type: string,
		id: string,
		placeholder: string,
		parent: HTMLElement,
		autocomplete?:
			| 'username'
			| 'current-password'
			| 'new-password'
			| 'off'
			| 'on'
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		if (autocomplete) input.autocomplete = autocomplete;
		input.className = 'border border-[var(--color3)] p-2';
		parent.appendChild(input);
		return input;
	}

	private createLinks(parent: HTMLElement) {
		const LinkContainer = document.createElement('div');
		LinkContainer.className =
			'flex flex-col items-center justify-center gap-1.5';

		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'No account yet? Register here';
		RegisterLink.className =
			'text-[var(--color3)] hover:text-[var(--color4)] underline cursor-pointer text-sm m-0';
		RegisterLink.onclick = () => this.handleRegister(parent);
		LinkContainer.appendChild(RegisterLink);

		const ForgotPasswordLink = document.createElement('button');
		ForgotPasswordLink.textContent = 'I forgot my password';
		ForgotPasswordLink.className =
			'text-[var(--color3)] hover:text-[var(--color4)] underline cursor-pointer text-sm m-0';
		ForgotPasswordLink.onclick = () => this.handleForgot(parent);
		LinkContainer.appendChild(ForgotPasswordLink);

		this.box.appendChild(LinkContainer);
	}

	private handleRegister(parent: HTMLElement) {
		this.destroy();
		new RegisterModal(parent);
	}

	private handleForgot(parent: HTMLElement) {
		const modal = new TextModal(parent, undefined, 'TOO BAD!', () =>
			this.UsernameField.focus()
		);
		modal.onClose = () => {
			this.UsernameField.focus();
			this.UsernameField.select();
		};
	}

	private showCodeInputView(authData: AuthResponse) {
		while (this.box.firstChild) {
			this.box.removeChild(this.box.firstChild);
		}
		// Create input for 2FA code
		const codeInput = this.myCreateInput(
			'text',
			'2fa-code',
			'Enter 2FA code',
			this.box
		);
		codeInput.focus();
		new Button(
			'Submit 2FA code',
			() => this.submit2FA(codeInput, authData),
			this.box
		);
	}

	private async submit2FA(
		codeInput: HTMLInputElement,
		authData: AuthResponse
	) {
		if (codeInput.value.length === 0) {
			return;
		}
		// Store the first token which is temporary to enable validation
		sessionStorage.setItem('token', authData.token);
		const { data: authDataNew, error } = await apiCall(
			'POST',
			'/users/2fa/validate',
			AuthResponseSchema,
			codeInput.value.trim()
		);
		if (error) {
			console.warn('2FA validation error:', error);
			this.destroy();
			new TextModal(this.parent, '2FA validation failed');
			return;
		}
		if (!authDataNew) {
			console.warn(
				'2FA validation failed: no data returned. This error should be caught earlier.'
			);
			this.destroy();
			new TextModal(this.parent, '2FA validation failed');
			return;
		}
		sessionStorage.setItem('username', authDataNew.login);
		this.login(authDataNew.token, authDataNew.user_id);
		this.destroy();
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		this.UsernameField.removeEventListener('keydown', this.handleEnter);
		this.PasswordField.removeEventListener('keydown', this.handleEnter);
		super.destroy();
	}
}
