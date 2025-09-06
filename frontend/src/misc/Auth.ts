import { webSocket } from './WebSocketWrapper';

export class AuthEvents {
	static LOGIN = 'app:login';
	static LOGOUT = 'app:logout';
	static AUTH_CHANGED= 'app:auth-changed';
}

export function login(token: string) {
	sessionStorage.setItem("token", token);
	webSocket.open();
	alert( 'You have been logged in successfully!');
	document.dispatchEvent(new CustomEvent(AuthEvents.LOGIN, {detail: {token}}));
	document.dispatchEvent(new CustomEvent(AuthEvents.AUTH_CHANGED, {detail: { isLoggedIn: true, token}}));
}

export function logout() {
	const token = sessionStorage.getItem("token");
	sessionStorage.removeItem("token");
	webSocket.close();
	alert( 'You have been logged out successfully!');
	document.dispatchEvent(new CustomEvent(AuthEvents.LOGOUT, {detail: {token}}));
	document.dispatchEvent(new CustomEvent(AuthEvents.AUTH_CHANGED, {detail: { isLoggedIn: false}}));
}

// Page loads:
// 1. Browser loads JavaScript
// 2. AuthComponent constructor runs
// 3. render() is called immediately
// 4. isLoggedIn() is checked
// 5. setupEventListeners() starts listening for FUTURE events

// Later, user logs in:
// 6. login() function runs
// 7. AuthEvent is dispatched
// 8. AuthComponent hears event and re-renders
