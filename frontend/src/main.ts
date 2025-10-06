import { AuthComponent, isLoggedIn } from './buttons/AuthButton';
import { HomeButton } from './buttons/HomeButton';
import { TwoFactAuthButton } from './buttons/TwoFactAuthButton';
import { Banner } from './utils/Banner';
import { Chat } from './utils/Chat';
import { router } from './utils/Router';
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';

import './style.css';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Global exposure for debugging
(window as any).state = state;
(window as any).webSocket = webSocket;

window.addEventListener('error', event => {
	console.error('Unhandled error', event.error);
});
window.addEventListener('unhandledrejection', event => {
	console.error('Unhandled promise rejection', event.reason);
});

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';
app.style.backgroundColor = 'black';
app.style.backgroundSize = 'cover';
app.style.backgroundPosition = 'center';
app.style.backgroundRepeat = 'no-repeat';


router.init();
new AuthComponent(app);
new HomeButton(app);
new TwoFactAuthButton(app);



// Persistent chat and banner management
let chat: Chat | null = null;
let banner: Banner | null = null;

function initChatBanner() {
	if (!isLoggedIn()) return;

	if (!chat) {
		chat = new Chat(app);
	}

	if (!banner) {
		banner = new Banner(app);
	}
}

function destroyChatBanner() {
	if (chat) {
		chat.destroy();
		chat = null;
	}

	if (banner) {
		banner.destroy();
		banner = null;
	}
}

// Listen for login state changes
document.addEventListener('login-success', initChatBanner);
document.addEventListener('logout-success', destroyChatBanner);

// Initialize on load if already logged in
if (isLoggedIn()) {
	initChatBanner();
}
