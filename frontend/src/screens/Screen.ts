export class Screen {
	public element: HTMLDivElement;

	constructor() {
		this.element = document.createElement('div');

		this.element.className = `
			mx-auto my-auto
			w-full h-full
			bg-gray-800/80
			shadow-2xl
			flex flex-col
			items-center justify-center
		`;

		// Attach to the SPA root
		const app = document.getElementById('app') as HTMLDivElement;
		app.appendChild(this.element);
	}
	public destroy(): void {
		if (this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
		// Clear reference for GC
		(this.element as any) = null;
	}
}
