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
if (import.meta.env.DEV) {
	(window as any).state = state;
	(window as any).webSocket = webSocket;
	console.log('✅ App initialized');
}

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



function setupMobile() {
	state.isMobile = window.innerWidth < 480;
}

async function initApp() {
	try {
		setupMobile();
		await getEndpoints();
		router.init();
		new AuthComponent(app);
		if (!state.isMobile) {
			new ChatManager(app);
		}
		
		console.log('App initialized', state.isMobile ? '(mobile mode)' : '(desktop mode)');
	} catch (err) {
		console.error('Failed to initialize app:', err);
	}
}

initApp();