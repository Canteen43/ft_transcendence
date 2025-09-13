// import { Video } from './misc/Video';
import { AuthComponent } from './misc/AuthComponent';
import { HomeButton } from './misc/HomeButton';
import { createParticlesBackground, initParticles } from  './misc/Particles';

import { Router } from './misc/Router';
import './style.css';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Global exposure for debugging
import { state } from './misc/state';
import { webSocket } from './utils/WebSocketWrapper';
(window as any).state = state;
(window as any).webSocket = webSocket;

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';


// Create particles background
createParticlesBackground(app);
requestAnimationFrame(() => {void initParticles();});

new AuthComponent(app);
new HomeButton(app);
new Router();
// new Video();
