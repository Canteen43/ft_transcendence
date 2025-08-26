import { Button } from '../components/Button';
import { LoginModal } from '../modals/LoginModal';

export class LoginButton extends Button {
	constructor(parent: HTMLElement) {
		super(
			'Login',
			() => {
				void new LoginModal(document.body);
			},
			parent
		);

		this.element.classList.add('absolute', 'top-4', 'right-4');
	}
}
