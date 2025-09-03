import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { LoginModal } from './LoginModal';
import { CreateUserSchema, UserSchema } from '../../../shared/schemas/user.ts';
import { apiCall } from '../utils/apiCall';

export class RegisterModal extends Modal {
	private UsernameField:HTMLInputElement;
	private FirstNameField:HTMLInputElement;
	private LastNameField:HTMLInputElement;
	private EmailField:HTMLInputElement;
	private PasswordField:HTMLInputElement;
	private PasswordRepeatField:HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col','items-center','justify-center','gap-2','p-4');

		this.UsernameField = this.myCreateInput('text', 'username', 'Enter your username');
		this.FirstNameField = this.myCreateInput('text', 'first_name', 'Enter your first name');
		this.LastNameField = this.myCreateInput('text', 'last_name', 'Enter your last name');
		this.EmailField = this.myCreateInput('email', 'email', 'Enter your email');
		this.PasswordField = this.myCreateInput('password', 'password', 'Enter your password (> 8 characters)');
		this.PasswordRepeatField = this.myCreateInput('password', 'passwordrepeat', 'Re-enter your password');
		new Button('Register', () => this.handleRegister(), this.box);
		this.createLinks(parent);
	}


		private async handleRegister() {
			const username = this.UsernameField.value.trim();
			const firstName = this.FirstNameField.value.trim();
			const lastName = this.LastNameField.value.trim();
			const email = this.EmailField.value.trim();
			const password = this.PasswordField.value.trim();
			const repeatPassword = this.PasswordRepeatField.value.trim();

			if (!this.verif(username, firstName, lastName, email, password, repeatPassword)) 
				return;

			const requestData = { login: username, 
				first_name: firstName,
				last_name: lastName,
				email: email,
				password_hash: password };

			const parseResult = CreateUserSchema.safeParse(requestData);
			if (!parseResult.success) {
				alert("Invalid login format");
				console.error("Request validation failed:", parseResult.error.format());
				return;
			}
			
			try {
				const regData = await apiCall(
					"POST",
					"/users/",
					UserSchema,
					requestData
				);

				if (!regData) {
					alert("Registration unsuccessful");
					return;
				}

			console.log('Registration successful for: ', regData.login);
			
			} catch (error) {
				console.error('Login error:', error);
			}
	}

	private verif(username: string, firstName: string, lastName: string, email: string,
							password: string, repeatPassword: string): boolean {
		// Username: required, 3–20 chars, only letters/numbers/underscores
		if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
			alert('Username must be 3–20 characters (letters, numbers, underscores)');
			return false;
		}

		// First name: optional, but if present → 1–30 letters
		if (firstName !== '' &&
			!/^[a-zA-Z]{1,30}$/.test(firstName)) {
			alert('First name must be 1–30 letters (if provided)');
			return false;
		}

		// Last name: optional, but if present → 1–30 letters
		if (lastName !== '' &&
			!/^[a-zA-Z]{1,30}$/.test(lastName)) {
			alert('Last name must be 1–30 letters (if provided)');
			return false;
		}

		// Email: required, simple check, max length
		if (!email.includes('@') || email.length > 100) {
			alert('Invalid or too long email');
			return false;
		}

		// Password: required, 8–64 chars
		if (password.length < 8 || password.length > 64) {
			alert('Password must be 8–64 characters');
			return false;
		}

		// Password confirmation
		if (password !== repeatPassword) {
			alert('Passwords do not match');
			return false;
		}

		return true;
	}


		private myCreateInput(type: string, id: string, placeholder: string): HTMLInputElement {
			const input = document.createElement('input');
			input.type = type;
			input.id = id;
			input.placeholder = placeholder;
			input.className = 'border border-gray-300 rounded p-2';
			this.box.appendChild(input);
			return input;
		}

		private createLinks(parent: HTMLElement) {
			const RegisterLink = document.createElement('button');
			RegisterLink.textContent = 'Go back to log-in';
			RegisterLink.className = 'text-pink-500 hover:text-pink-700 underline cursor-pointer text-sm';
			RegisterLink.onclick = () => this.handleGoBack(parent);
			this.box.appendChild(RegisterLink);

		}


	private handleGoBack(parent: HTMLElement) { 
		this.destroy();
		new LoginModal(parent);
	}

}
