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
		this.PasswordField = this.myCreateInput('password', 'password', 'Enter your password');
		this.PasswordRepeatField = this.myCreateInput('password', 'passwordrepeat', 'Re-enter your password');
		new Button('Login', () => this.handleRegister(), this.box);
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

		private async handleRegister() {
			const username = this.UsernameField.value;
			const firstName = this.FirstNameField.value;
			const lastName = this.LastNameField.value;
			const email = this.EmailField.value;
			const password = this.PasswordField.value;
			const passwordRepeat = this.PasswordRepeatField.value;

			if (password !== passwordRepeat) {
				alert('Passwords do not match!');
				return;
			}

			try {
				const response = await fetch('http://localhost:8080/users/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ login: username, first_name: firstName, last_name: lastName, email:email, password_hash: password }),
				});

				if (response.ok) {
					const authData = await response.json();
					console.log('Login successful:', authData);
					this.destroy();
				} else {
					console.error('Login unsuccessful');
				}
			} catch (error) {
				console.error('Login error:', error);
			}
		}

	private handleGoBack(parent: HTMLElement) { 
		this.destroy();
		new LoginModal(parent);
	}

}
