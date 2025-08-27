import { Router } from './misc/Router';
import { Video } from './misc/Video';
import './style.css';

// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';

void new Video();
void new Router();