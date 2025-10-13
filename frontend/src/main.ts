import { AuthComponent } from './buttons/AuthButton';
import { ChatManager } from './utils/Chat';
import { router } from './utils/Router';
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';
import { getEndpoints } from './utils/endpoints';

// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';
import './style.css';

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
app.className = 'w-screen h-screen flex flex-col bg-white bg-center';
app.style.backgroundSize = 'cover';
app.style.backgroundPosition = 'center';
app.style.backgroundRepeat = 'no-repeat';

async function initApp() {
	try {
		await getEndpoints();

		router.init();

		new AuthComponent(app);
		new ChatManager(app); 

		console.log('App initialized');
	} catch (error) {
		console.error('Failed to initialize app:', error);
	}
}

async function requestFullscreen() {
	const elem = document.documentElement;
	if (elem.requestFullscreen && window.innerWidth < 768) {
		try {
			await elem.requestFullscreen();
		} catch (error) {
			console.warn('Fullscreen request failed:', error);
		}
	}
}

// Request fullscreen on mobile
initApp().then(() => {
	requestFullscreen();
});
