// import { Video } from './misc/Video';
import { Router } from './misc/Router';
import { AuthComponent } from './misc/AuthComponent';
import './style.css';
// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

// Expose state globally for debugging
import { state } from './misc/state';
(window as any).state = state;

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';

new AuthComponent(app);
new Router();
// new Video();