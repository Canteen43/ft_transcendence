import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { LoginModal } from './LoginModal';


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
		new Button('Register', () => this.handleRegister(parent), this.box);
		this.createLinks(parent);
	}


		// helpers
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

		private async handleRegister(parent: HTMLElement) {
			const username = this.UsernameField.value.trim();
			const firstName = this.FirstNameField.value.trim();
			const lastName = this.LastNameField.value.trim();
			const email = this.EmailField.value.trim();
			const password = this.PasswordField.value.trim();
			const repeatPassword = this.PasswordRepeatField.value.trim();

			if (!this.verif(username, firstName, lastName, email, password, repeatPassword)) 
				return;

			try {
				const response = await fetch('http://localhost:8080/users/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ login: username, first_name: firstName, last_name: lastName, email:email, password_hash: password }),
				});

				if (response.ok) {
					const authData = await response.json();
					console.log('Login successful:', authData);
					alert('You registered successfully! You can now login.');
					new LoginModal(parent);
					this.destroy();
				} else {
					console.error('Login unsuccessful');
					alert('Registration unsuccessful :(');
				}
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
		if (this.FirstNameField.value.trim() !== '' &&
			!/^[a-zA-Z]{1,30}$/.test(this.FirstNameField.value)) {
			alert('First name must be 1–30 letters (if provided)');
			return false;
		}

		// Last name: optional, but if present → 1–30 letters
		if (this.LastNameField.value.trim() !== '' &&
			!/^[a-zA-Z]{1,30}$/.test(this.LastNameField.value)) {
			alert('Last name must be 1–30 letters (if provided)');
			return false;
		}

		// Email: required, simple check, max length
		if (!this.EmailField.value.includes('@') || this.EmailField.value.length > 100) {
			alert('Invalid or too long email');
			return false;
		}

		// Password: required, 8–64 chars
		if (this.PasswordField.value.length < 8 || this.PasswordField.value.length > 64) {
			alert('Password must be 8–64 characters');
			return false;
		}

		// Password confirmation
		if (this.PasswordField.value !== this.PasswordRepeatField.value) {
			alert('Passwords do not match');
			return false;
		}

		return true;
	}

	private handleGoBack(parent: HTMLElement) { 
		this.destroy();
		new LoginModal(parent);
	}

}
