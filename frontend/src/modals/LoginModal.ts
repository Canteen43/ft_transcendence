// import {
// 	AuthRequest,
// 	AuthResponse,
// 	AuthResponseSchema,
// } from '../../../shared/schemas/user.ts';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
// import { apiCall } from '../utils/apiCall.ts';

export class LoginModal extends Modal {
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

		// Create a password input
		const PasswordField = document.createElement('input');
		PasswordField.type = 'password';
		PasswordField.id = 'password';
		PasswordField.placeholder = 'Enter your password';
		PasswordField.className = 'border border-gray-300 rounded p-2';
		this.box.appendChild(PasswordField);

		void new Button(
			'Login',
			async () => {
				const username = UsernameField.value;
				const password = PasswordField.value;

				const response = await apiCall<AuthResponse>(
					'/users/auth',
					AuthResponseSchema,
					{
						username,
						password,
					}
				);
				if (response) {
					alert('Login successful!');
				}
			},
			this.box
		);
	}
}
