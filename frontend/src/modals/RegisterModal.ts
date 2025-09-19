import { z } from 'zod';
import { CreateUserSchema, UserSchema } from '../../../shared/schemas/user.ts';
import { Button } from '../buttons/Button.ts';
import { apiCall } from '../utils/apiCall';
import { LoginModal } from './LoginModal';
import { Modal } from './Modal.ts';

export class RegisterModal extends Modal {
	private UsernameField: HTMLInputElement;
	private FirstNameField: HTMLInputElement;
	private LastNameField: HTMLInputElement;
	private EmailField: HTMLInputElement;
	private PasswordField: HTMLInputElement;
	private PasswordRepeatField: HTMLInputElement;

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

		this.UsernameField = this.myCreateInput('text', 'username', 'username');
		this.FirstNameField = this.myCreateInput(
			'text',
			'first_name',
			'first name'
		);
		this.LastNameField = this.myCreateInput(
			'text',
			'last_name',
			'last name'
		);
		this.EmailField = this.myCreateInput('email', 'email', 'email');
		this.PasswordField = this.myCreateInput(
			'password',
			'password',
			'password'
		);
		this.PasswordRepeatField = this.myCreateInput(
			'password',
			'passwordrepeat',
			'password repeat'
		);
		new Button('Register', () => this.handleRegister(parent), this.box);
		this.createLinks(parent);

		this.UsernameField.focus();
	}

	private formatZodErrors(error: z.ZodError): string {
		return error.issues
			.map(err => {
				const field = err.path.join('.');
				return `${field}: ${err.message}`;
			})
			.join('\n');
	}

	private async handleRegister(parent: HTMLElement) {
		const username = this.UsernameField.value.trim();
		const firstName = this.FirstNameField.value.trim();
		const lastName = this.LastNameField.value.trim();
		const email = this.EmailField.value.trim();
		const password = this.PasswordField.value.trim();
		const repeatPassword = this.PasswordRepeatField.value.trim();

		if (password !== repeatPassword) {
			alert('Passwords do not match');
			return;
		}

		const requestData = {
			login: username,
			first_name: firstName || null,
			last_name: lastName || null,
			email: email || null,
			password: password,
		};

		const parseResult = CreateUserSchema.safeParse(requestData);
		if (!parseResult.success) {
			const errorMessage = this.formatZodErrors(parseResult.error);
			alert(errorMessage);
			console.error('Request validation failed:', parseResult.error);
			return;
		}

		const regData = await apiCall(
			'POST',
			'/users/',
			UserSchema,
			requestData
		);
		if (!regData) {
			alert('Registration unsuccessful');
			return;
		}
		console.log('Registration successful for: ', regData.login);
		new LoginModal(parent);
		this.destroy();
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
		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'Back to log-in';
		RegisterLink.className =
			'text-[var(--color3)] hover:text-[var(--color4)] underline cursor-pointer text-sm';
		RegisterLink.onclick = () => this.handleGoBack(parent);
		this.box.appendChild(RegisterLink);
	}

	private handleGoBack(parent: HTMLElement) {
		this.destroy();
		new LoginModal(parent);
	}
}
