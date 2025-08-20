import './style.css';
import { HomeScreen } from './screens/HomeScreen';

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col'; // full width & height

// Video element
const video = document.createElement('video');
video.src = '/galaxy2_small.mp4'; // replace with your video path
video.autoplay = true;
video.loop = true;
video.muted = true;
video.className = 'absolute inset-0 w-full h-full object-cover -z-10';
video.playbackRate = 1;
app.appendChild(video);

void new HomeScreen();


