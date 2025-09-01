import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export class RegisterModal extends Modal {
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

		// Create an input 
		const UsernameField = document.createElement('input');
		UsernameField.type = 'text';
		UsernameField.id = 'username';
		UsernameField.placeholder = 'Enter your username';
		UsernameField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(UsernameField);

		// Create an input
		const FirstNameField = document.createElement('input');
		FirstNameField.type = 'text';
		FirstNameField.id = 'first_name';
		FirstNameField.placeholder = 'Enter your first name';
		FirstNameField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(FirstNameField);

		// Create an input
		const LastNameField = document.createElement('input');
		LastNameField.type = 'text';
		LastNameField.id = 'last_name';
		LastNameField.placeholder = 'Enter your last name';
		LastNameField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(LastNameField);

		// Create an input
		const EmailField = document.createElement('input');
		EmailField.type = 'text';
		EmailField.id = 'email';
		EmailField.placeholder = 'Enter your email';
		EmailField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(EmailField);

		// Create an input
		const PasswordField = document.createElement('input');
		PasswordField.type = 'password';
		PasswordField.id = 'password';
		PasswordField.placeholder = 'Enter your password';
		PasswordField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(PasswordField);

		// Create an input
		const PasswordRepeatField = document.createElement('input');
		PasswordRepeatField.type = 'password';
		PasswordRepeatField.id = 'password_repeat';
		PasswordRepeatField.placeholder = 'Confirm your password';
		PasswordRepeatField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(PasswordRepeatField);
		
		void new Button(
			'Register',
			async () => {
				const username = UsernameField.value;
				const firstName = FirstNameField.value;
				const lastName = LastNameField.value;
				const email = EmailField.value;
				const password = PasswordField.value;
				const passwordRepeat = PasswordRepeatField.value;

				if (password !== passwordRepeat) {
					alert('Passwords do not match!');
					return;
				}
			},
			this.box
		);
	}
}

