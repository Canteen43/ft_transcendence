export class Video {
	private videoElement: HTMLVideoElement;

	constructor() {
		this.videoElement = document.createElement('video');
		this.videoElement.src = '/galaxy2_small.mp4';
		this.videoElement.autoplay = true;
		this.videoElement.loop = true;
		this.videoElement.muted = true;
		this.videoElement.className =
			'absolute inset-0 w-full h-full object-cover -z-10';
		this.videoElement.playbackRate = 1;
		this.videoElement.id = 'background-video';
		document.getElementById('app')?.appendChild(this.videoElement);
	}
}
