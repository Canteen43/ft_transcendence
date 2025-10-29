import { z } from 'zod';
import { CreateUserSchema, UserSchema } from '../../../shared/schemas/user.ts';
import { Button } from '../buttons/Button.ts';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { LoginModal } from './LoginModal';
import { Modal } from './Modal.ts';
import { TextModal } from './TextModal';

export class RegisterModal extends Modal {
	private handleEnter: (e: KeyboardEvent) => void;
	private UsernameField: HTMLInputElement;
	private FirstNameField: HTMLInputElement;
	private LastNameField: HTMLInputElement;
	private EmailField: HTMLInputElement;
	private PasswordField: HTMLInputElement;
	private PasswordRepeatField: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		if (state.currentModal) {
			state.currentModal.destroy();
			state.currentModal = null;
		}

		const form = document.createElement('form');
		form.className = 'flex flex-col gap-4';
		this.box.appendChild(form);

		this.UsernameField = this.myCreateInput(
			'text',
			'username',
			'username*',
			form,
			'username'
		);
		this.FirstNameField = this.myCreateInput(
			'text',
			'first_name',
			'first name',
			form,
			'given-name'
		);
		this.LastNameField = this.myCreateInput(
			'text',
			'last_name',
			'last name',
			form,
			'family-name'
		);
		this.EmailField = this.myCreateInput(
			'email',
			'email',
			'email',
			form,
			'email'
		);
		this.PasswordField = this.myCreateInput(
			'password',
			'password',
			'password*',
			form,
			'new-password'
		);
		this.PasswordRepeatField = this.myCreateInput(
			'password',
			'passwordrepeat',
			'password repeat*',
			form,
			'new-password'
		);
		new Button('Register', () => this.handleRegister(), this.box);
		this.createLinks(parent);
		
		this.handleEnter = (e: KeyboardEvent) => {
			if (e.key == 'Enter') {
				e.preventDefault();
				this.handleRegister();
			}
		};
		this.addEnterListener();
		
		this.activateFocusTrap();
		this.UsernameField.select();
	}

	private errorModal(message: string) {
		const modal = new TextModal(this.parent, message);
		modal.onClose = () => {
			this.UsernameField.focus();
			this.UsernameField.select();
		};
	}

	private addEnterListener() {
		this.UsernameField.addEventListener('keydown', this.handleEnter);
		this.FirstNameField.addEventListener('keydown', this.handleEnter);
		this.LastNameField.addEventListener('keydown', this.handleEnter);
		this.EmailField.addEventListener('keydown', this.handleEnter);
		this.PasswordField.addEventListener('keydown', this.handleEnter);
		this.PasswordRepeatField.addEventListener('keydown', this.handleEnter);
	}

	private formatZodErrors(error: z.ZodError): string {
		return error.issues
			.map(err => {
				const field = err.path.join('.');
				return `${field}: ${err.message}`;
			})
			.join('\n');
	}

	private async handleRegister() {
		const username = this.UsernameField.value.trim();
		const firstName = this.FirstNameField.value.trim();
		const lastName = this.LastNameField.value.trim();
		const email = this.EmailField.value.trim();
		const password = this.PasswordField.value;
		const repeatPassword = this.PasswordRepeatField.value;

		if (password !== repeatPassword) {
			this.errorModal('Passwords do not match');
			return;
		}

		const requestData = {
			login: username,
			alias: username || null,
			first_name: firstName || null,
			last_name: lastName || null,
			email: email || null,
			password: password,
			two_factor_enabled: 0,
		};
		console.debug(`${JSON.stringify(requestData)}`);
		const parseResult = CreateUserSchema.safeParse(requestData);
		if (!parseResult.success) {
			const errorMessage = this.formatZodErrors(parseResult.error);
			console.debug('showing error modal:', errorMessage);
			this.errorModal(errorMessage);
			console.error('Request validation failed:', parseResult.error);
			return;
		}

		const { data: regData, error } = await apiCall(
			'POST',
			'/users/',
			UserSchema,
			requestData
		);
		if (error) {
			console.error('Registration error:', error);
			const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
			this.errorModal(message);
			return;
		}
		if (!regData) {
			this.errorModal('Registration failed: no data returned');
			return;
		}
		console.log('Registration successful for: ', regData.login);
		new LoginModal(this.parent);
		this.destroy();
	}

	private myCreateInput(
		type: string,
		id: string,
		placeholder: string,
		parent: HTMLElement,
		autocomplete?:
			| 'username'
			| 'email'
			| 'new-password'
			| 'given-name'
			| 'family-name'
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		if (autocomplete) input.autocomplete = autocomplete;
		input.className =
			'border border-[var(--color3)] p-1.5 sm:p-2 text-xs sm:text-sm md:text-base';
		parent.appendChild(input);
		return input;
	}

	private createLinks(parent: HTMLElement) {
		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'Back to log-in';
		RegisterLink.className =
			'text-[var(--color3)] hover:text-[var(--color4)] underline cursor-pointer text-xs sm:text-sm m-0';
		RegisterLink.onclick = () => this.handleGoBack(parent);
		this.box.appendChild(RegisterLink);
	}

	private handleGoBack(parent: HTMLElement) {
		this.destroy();
		new LoginModal(parent);
	}

	public destroy(): void {
		this.UsernameField.removeEventListener('keydown', this.handleEnter);
		this.FirstNameField.removeEventListener('keydown', this.handleEnter);
		this.LastNameField.removeEventListener('keydown', this.handleEnter);
		this.EmailField.removeEventListener('keydown', this.handleEnter);
		this.PasswordField.removeEventListener('keydown', this.handleEnter);
		this.PasswordRepeatField.removeEventListener(
			'keydown',
			this.handleEnter
		);

		// Call parent destroy
		super.destroy();
	}
}
