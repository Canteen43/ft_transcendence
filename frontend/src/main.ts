// import { createParticlesBackground, initParticles } from './visual/Particles';
// import { Video } from './misc/Video';
import { AuthComponent } from './buttons/AuthButton';
import { HomeButton } from './buttons/HomeButton';
import { TwoFactAuthButton } from './buttons/TwoFactAuthButton';

import './style.css';
import { router } from './utils/Router';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Global exposure for debugging
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';
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
