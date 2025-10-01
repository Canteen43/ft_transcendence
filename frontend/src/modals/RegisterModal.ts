import { z } from 'zod';
import { CreateUserSchema, UserSchema } from '../../../shared/schemas/user.ts';
import { Button } from '../buttons/Button.ts';
import { apiCall } from '../utils/apiCall';
import { LoginModal } from './LoginModal';
import { Modal } from './Modal.ts';
import { TextModal } from './TextModal';

export class RegisterModal extends Modal {
	private handleEnter: (e: KeyboardEvent) => void;
	private UsernameField: HTMLInputElement;
	private AliasField: HTMLInputElement;
	private FirstNameField: HTMLInputElement;
	private LastNameField: HTMLInputElement;
	private EmailField: HTMLInputElement;
	private PasswordField: HTMLInputElement;
	private PasswordRepeatField: HTMLInputElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.box.className +=
			'flex flex-col items-center justify-center gap-2 p-4';

		this.UsernameField = this.myCreateInput('text', 'username', 'username');
		this.AliasField = this.myCreateInput('text', 'alias', 'game alias');
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
		new Button('Register', () => this.handleRegister(), this.box);
		this.createLinks(parent);

		this.UsernameField.focus();

		this.handleEnter = (e: KeyboardEvent) => {
			if (e.key == 'Enter') {
				e.preventDefault();
				this.handleRegister();
			}
		};
		this.addEnterListener();
	}

	private errorModal(message: string) {
		const modal = new TextModal(this.parent, message, undefined, () => {
			this.UsernameField.focus();
			this.UsernameField.select();
		});
		modal.onClose = () => {
			this.UsernameField.focus();
			this.UsernameField.select();
		};
	}

	private addEnterListener() {
		this.UsernameField.addEventListener('keydown', this.handleEnter);
		this.AliasField.addEventListener('keydown', this.handleEnter);
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
		const alias = this.AliasField.value.trim();
		const firstName = this.FirstNameField.value.trim();
		const lastName = this.LastNameField.value.trim();
		const email = this.EmailField.value.trim();
		const password = this.PasswordField.value.trim();
		const repeatPassword = this.PasswordRepeatField.value.trim();

		if (password !== repeatPassword) {
			this.errorModal('Passwords do not match');
			return;
		}

		// export const CreateUserSchema = z.object({
		// 	login: z.string().pipe(loginSchema),
		// 	alias: z.string().pipe(loginSchema).nullable(),
		// 	first_name: z.string().pipe(nameSchema).nullable(),
		// 	last_name: z.string().pipe(nameSchema).nullable(),
		// 	email: z.email().nullable(),
		// 	password: z.string().pipe(passwordSchema),
		// 	two_factor_enabled: z.preprocess(val => {
		// 		if (typeof val === 'boolean') return val;
		// 		const validated = z.number().min(0).max(1).parse(val);
		// 		return validated === 1;
		// 	}, z.boolean()),
		// });

		// export const AuthRequestSchema = z.object({
		// 	login: z.string(),
		// 	password: z.string(),
		// });

		// export const AuthResponseSchema = z
		// 	.object({
		// 		login: z.string(),
		// 		user_id: zUUID,
		// 		token: z.string(),
		// 		two_factor_enabled: z.boolean(),
		// 	})
		// 	.refine(data => data.two_factor_enabled || data.token !== undefined);

		const requestData = {
			login: username,
			alias: alias || null,
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
		placeholder: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		input.className = 'border border-[var(--color3)] p-2';
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
		
		this.UsernameField.removeEventListener('keydown', this.handleEnter);
		this.AliasField.removeEventListener('keydown', this.handleEnter);
		this.FirstNameField.removeEventListener('keydown', this.handleEnter);
		this.LastNameField.removeEventListener('keydown', this.handleEnter);
		this.EmailField.removeEventListener('keydown', this.handleEnter);
		this.PasswordField.removeEventListener('keydown', this.handleEnter);
		this.PasswordRepeatField.removeEventListener(
			'keydown',
			this.handleEnter
		);
		
		this.destroy();
		new LoginModal(parent);
	}
}
