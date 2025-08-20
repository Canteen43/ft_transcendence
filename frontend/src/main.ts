import './style.css';
import { Router } from './misc/Router';
import { Video } from './misc/Video';

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col';

void new Video();
void new Router();
