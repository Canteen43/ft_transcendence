import { AuthRequestSchema, AuthResponseSchema } from '../../../shared/schemas/user.ts';
import { apiCall } from '../utils/apiCall';
import { webSocket } from '../misc/WebSocketWrapper';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { RegisterModal } from './RegisterModal';
import { ForgottenModal } from './ForgottenModal';
import { z } from "zod";


export class LoginModal extends Modal {
	private UsernameField: HTMLInputElement;
	private PasswordField: HTMLInputElement;
	private loginButton: Button | null = null;
	private logoutButton: Button | null = null;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');
		this.UsernameField = this.myCreateInput('text', 'username', 'Enter your username');
		this.PasswordField = this.myCreateInput('password', 'password', 'Enter your password');

		if (this.isLoggedIn()) {
			this.showLogoutButton(parent);
		} else {
			this.showLoginButton(parent);
		}

		this.createLinks(parent);
	}

	private isLoggedIn(): boolean {
		const token = sessionStorage.getItem("token");
		return (token != null && token != "");
	}
	
	private showLoginButton(parent:HTMLElement) {
		if (this.logoutButton) {
			this.logoutButton.destroy();
			this.logoutButton = null;
		}
		this.loginButton = new Button('Login', () => this.handleLogin(parent), this.box);
	}

	private showLogoutButton(parent:HTMLElement) {
		if (this.loginButton) {
			this.loginButton.destroy();
			this.loginButton = null;
		}
		this.logoutButton = new Button('Login', () => this.handleLogout(parent), this.box);
	}

	private async handleLogin(parent: HTMLElement) {
		const username = this.UsernameField.value.trim();
		const password = this.PasswordField.value.trim();

		if (!username || !password) {
			alert("Please enter both username and password");
			return;
		}

		const requestData = { login: username, password_hash: password };

		const parseResult = AuthRequestSchema.safeParse(requestData);
		if (!parseResult.success) {
			alert("Invalid login format");
			console.error("Request validation failed:", z.treeifyError(parseResult.error));
			return;
		}

		try {
			const authData = await apiCall("POST", "/users/auth", AuthResponseSchema, requestData);
			if (!authData) {
				alert("Login unsuccessful");
				return;
			}
			alert( 'You logged-in successfully! You can now play remotely, ' + authData.login);
			
			// Store JWT token, open socket 
			sessionStorage.setItem("token", authData.token);
			webSocket.open();

			// Switch to logout button
			this.showLogoutButton(parent);

			this.UsernameField.value = '';
			this.PasswordField.value = '';

		} catch (error) {
			console.error('Login error:', error);
		}
	}


	private async handleLogout(parent: HTMLElement) {
		// Remove JWT token, close socket 
		sessionStorage.removeItem("token");
		webSocket.close();
		alert( 'You have been logged out successfully!');
		this.showLoginButton(parent);
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
	
	private handleRegister(parent: HTMLElement) {
		this.destroy();
		new RegisterModal(parent);
	}

	private handleForgot(parent: HTMLElement) {
		new ForgottenModal(parent);
	}
}