// import {
// 	AuthRequest,
// 	AuthResponse,
// 	AuthResponseSchema,
// } from '../../../shared/schemas/user.ts';

import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { RegisterModal } from './RegisterModal';
import { webSocket } from '../misc/WebSocketWrapper';
import { ForgottenModal } from './ForgottenModal';


export class LoginModal extends Modal {
	private UsernameField: HTMLInputElement;
	private PasswordField: HTMLInputElement;


	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		this.UsernameField = this.myCreateInput('text', 'username', 'Enter your username');
		this.PasswordField = this.myCreateInput('password', 'password', 'Enter your password');
		new Button('Login', () => this.handleLogin(), this.box);
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

		// Create a password input
		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'No account yet? Register here';
		RegisterLink.className = 'text-pink-500 hover:text-pink-700 underline cursor-pointer text-sm';
		RegisterLink.onclick = () => this.handleRegister(parent);
		this.box.appendChild(RegisterLink);

		// Create a password input
		const ForgotPasswordLink = document.createElement('button');
		ForgotPasswordLink.textContent = 'I forgot my password';
		ForgotPasswordLink.className = 'text-pink-500 hover:text-pink-700 underline cursor-pointer text-sm';
		ForgotPasswordLink.onclick = () => this.handleForgot(parent);
		this.box.appendChild(ForgotPasswordLink);

	}

	private async handleLogin() {
		const username = this.UsernameField.value;
		const password = this.PasswordField.value;

		try {
			const response = await fetch('http://localhost:8080/users/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ login: username, password_hash: password }),
			});

			if (response.ok) {
				const authData = await response.json();
				if (authData.token) {
					sessionStorage.setItem("token", authData.token);
				}
				console.log('Login successful for: ', authData.login);
				//alert('You logged-in successfully! You can now play remotely, '  + authData.login + '  ' + authData.token);
				// This belongs here
				webSocket.open();
				// This is just to test that the websocket is working
				webSocket.addMessageListener((event) => {
					alert('Message from server: ' + event.data);
				});
				webSocket.send("Test message!");
				this.destroy();
			} else {
				alert('Login unsuccessful');
				console.error('Login unsuccessful');
			}
		} catch (error) {
			console.error('Login error:', error);
		}
	}


	private handleRegister(parent: HTMLElement) {
		this.destroy();
		new RegisterModal(parent);
	}

	private handleForgot(parent: HTMLElement) { 
		new ForgottenModal(parent);
	}
}