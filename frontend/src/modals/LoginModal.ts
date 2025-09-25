import { z } from 'zod';
import {
	AuthRequestSchema,
	AuthResponseSchema,
} from '../../../shared/schemas/user.ts';
import { Button } from '../buttons/Button.ts';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper.ts';
import { ForgottenModal } from './ForgottenModal';
import { Modal } from './Modal.ts';
import { RegisterModal } from './RegisterModal';
import { TextModal } from './TextModal';

export class LoginModal extends Modal {
	private UsernameField: HTMLInputElement;
	private PasswordField: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.UsernameField = this.myCreateInput(
			'text',
			'username',
			'Enter your username'
		);
		this.PasswordField = this.myCreateInput(
			'password',
			'password',
			'Enter your password'
		);
		new Button('Login', () => this.handleLogin(), this.box);
		this.createLinks(parent);

		this.UsernameField.focus();
		this.UsernameField.select();

		this.addEnterListener();
	}

	private addEnterListener() {
		const handleEnter = (e: KeyboardEvent) => {
			if (e.key == 'Enter') {
				e.preventDefault();
				this.handleLogin();
			}
		};
		this.UsernameField.addEventListener('keydown', handleEnter);
		this.PasswordField.addEventListener('keydown', handleEnter);
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
			new TextModal(this.parent, message);
			return;
		}
		if (!authData) {
			new TextModal(this.parent, 'Login unsuccessful');
			return;
		}

		console.log('Login successful for: ', authData.login);
		sessionStorage.setItem('username', username);
		this.login(authData.token, authData.user_id);

		this.destroy();
	}

	private login(token: string, id: string) {
		sessionStorage.setItem('token', token);
		sessionStorage.setItem('userID', id);
		webSocket.open();
		document.dispatchEvent(new CustomEvent('login-success'));
		console.info('Login successful');
	}

	private myCreateInput(
		type: string,
		id: string,
		placeholder: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		input.className = 'border border-[var(--color3)] rounded p-2';
		this.box.appendChild(input);
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
		new ForgottenModal(parent);
	}
}
