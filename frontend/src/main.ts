import { AuthComponent } from './buttons/AuthButton';
import { HomeButton } from './buttons/HomeButton';
import { ChatBannerManager } from './utils/ChatBannerManager';
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

await getEndpoints();
router.init();
new AuthComponent(app);
new HomeButton(app);
new ChatBannerManager(app);
