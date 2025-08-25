import { Button } from '../components/Button';

export class LoginButton extends Button {
	constructor(parent: HTMLElement) {
		super(
			'Login',
			() => {
				alert('Login clicked');
			},
			parent
		);

		this.element.classList.add('absolute', 'top-4', 'right-4');
	}
}
