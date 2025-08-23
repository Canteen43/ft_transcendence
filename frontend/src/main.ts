import { Router } from './misc/Router';
import { Video } from './misc/Video';
import './style.css';

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';

// TODO: Try removing this hacky solution to load GLTF loader. Import didn't work
const response = await fetch(
	'https://preview.babylonjs.com/loaders/babylon.glTF2FileLoader.js'
);
const scriptText = await response.text();
eval(scriptText);

void new Video();
void new Router();
