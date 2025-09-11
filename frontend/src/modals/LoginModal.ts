import { z } from 'zod';
import {
	AuthRequestSchema,
	AuthResponseSchema,
} from '../../../shared/schemas/user.ts';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { apiCall } from '../utils/apiCall';
import { webSocket } from '../utils/WebSocketWrapper.ts';
import { ForgottenModal } from './ForgottenModal';
import { RegisterModal } from './RegisterModal';

export class LoginModal extends Modal {
	private UsernameField: HTMLInputElement;
	private PasswordField: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add(
			'flex',
			'flex-col',
			'items-center',
			'justify-center',
			'gap-2',
			'p-4'
		);
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
	}

	private async handleLogin() {
		const username = this.UsernameField.value.trim();
		const password = this.PasswordField.value.trim();

		const requestData = { login: username, password: password };

		const parseResult = AuthRequestSchema.safeParse(requestData);
		if (!parseResult.success) {
			alert('Invalid login format');
			console.error(
				'Request validation failed:',
				z.treeifyError(parseResult.error)
			);
			return;
		}

		const authData = await apiCall(
			'POST',
			'/users/auth',
			AuthResponseSchema,
			requestData
		);
		if (!authData) {
			alert('Login unsuccessful');
			return;
		}
		this.login(authData.token);
		sessionStorage.setItem('username', username);
		this.destroy();
	}

	private login(token: string) {
		sessionStorage.setItem('token', token);
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
		input.className = 'border border-[var(--color1)] rounded p-2';
		this.box.appendChild(input);
		return input;
	}

	private createLinks(parent: HTMLElement) {
		// Create a password input
		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'No account yet? Register here';
		RegisterLink.className =
			'text-[var(--color1)] hover:text-[var(--color1bis)] underline cursor-pointer text-sm';
		RegisterLink.onclick = () => this.handleRegister(parent);
		this.box.appendChild(RegisterLink);
		// Create a password input
		const ForgotPasswordLink = document.createElement('button');
		ForgotPasswordLink.textContent = 'I forgot my password';
		ForgotPasswordLink.className =
			'text-[var(--color1)] hover:text-[var(--color1bis)] underline cursor-pointer text-sm';
		ForgotPasswordLink.onclick = () => this.handleForgot(parent);
		this.box.appendChild(ForgotPasswordLink);
	}

	private handleRegister(parent: HTMLElement) {
		this.destroy();
		new RegisterModal(parent);
	}

	private handleForgot(parent: HTMLElement) {
		new ForgottenModal(parent);
	}
}
