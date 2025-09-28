// import { createParticlesBackground, initParticles } from './visual/Particles';
// import { Video } from './misc/Video';
import { AuthComponent } from './buttons/AuthButton';
import { HomeButton } from './buttons/HomeButton';

import './style.css';
import { router } from './utils/Router';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Global exposure for debugging
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';
(window as any).state = state;
(window as any).webSocket = webSocket;

import sky from '/sky2.jpg';
const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';
app.style.backgroundImage = `url(${sky})`;
app.style.backgroundSize = 'cover';
app.style.backgroundPosition = 'center';
app.style.backgroundRepeat = 'no-repeat';

router.init();
new AuthComponent(app);
new HomeButton(app);


// Create particles background
// createParticlesBackground(app);
// requestAnimationFrame(() => {
// 	void initParticles();
// });

// new Video();
