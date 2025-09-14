// import { Video } from './misc/Video';
import { AuthComponent } from './buttons/AuthButton';
import { HomeButton } from './buttons/HomeButton';
import { createParticlesBackground, initParticles } from './visual/Particles';

import { Router } from './utils/Router';
import './style.css';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Global exposure for debugging
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';
(window as any).state = state;
(window as any).webSocket = webSocket;

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';

// Create particles background
createParticlesBackground(app);
requestAnimationFrame(() => {
	void initParticles();
});

new AuthComponent(app);
new HomeButton(app);
new Router();
// new Video();
