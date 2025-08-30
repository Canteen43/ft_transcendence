import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { RegisterModal } from './RegisterModal';
// import { ForgottenPwModal } from './ForgottenPwModal';

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
				
				// fastify.post<{ Body: AuthRequest }>('/auth', getHttpResponse({ body: AuthRequestSchema, response: UserSchema }), authenticate);
				// export const AuthRequestSchema = z.object({ login: z.string(),password_hash: z.string(),});	},this.box);
				try {
					const response = await fetch('/users/auth', {
						method : 'POST',
						headers: { 'Content-Type': 'application/json', },
						body: JSON.stringify({
							login: username,
							password_hash: password,
						})
					});
					if (response.ok) {
						const authData = await response.json();
						console.log('Login successful:', authData);
						this.destroy();
					}
					else {
						console.error('Login unsuccessful');
					}
				}
				catch (error) {
					console.error('Login error:', error);
				}
			},
			this.box
		);

		// Create a password input
		const RegisterLink = document.createElement('button');
		RegisterLink.textContent = 'No account yet? Register here';
		RegisterLink.className = 'text-pink-500 hover:text-pink-700 underline cursor-pointer text-sm';
		RegisterLink.onclick = () => { 
			this.destroy();
			new RegisterModal(parent);
		}
		this.box.appendChild(RegisterLink);

		// Create a password input
		const ForgotPasswordLink = document.createElement('button');
		ForgotPasswordLink.textContent = 'I forgot my password';
		ForgotPasswordLink.className = 'text-pink-500 hover:text-pink-700 underline cursor-pointer text-sm';
		ForgotPasswordLink.onclick  = () => { 
			this.destroy();
			// new ForgottenPwModal(this.parent);
		}
		this.box.appendChild(ForgotPasswordLink);
	}
}

