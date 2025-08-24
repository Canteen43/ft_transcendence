import { Button } from '../components/Button';

export class LoginButton extends Button {
	constructor() {
		super();

		this.element.classList.add('absolute', 'top-4', 'right-4');
		
	}
}
