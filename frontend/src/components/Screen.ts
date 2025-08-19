export class Screen {
	protected element: HTMLDivElement;

	constructor() {
		this.element = document.createElement('div');

		// Tailwind classes for a centered "page" with 85% width & height
		this.element.className = `
			mx-auto my-auto
			w-[85%] h-[85%]
			bg-gray-500/80
			rounded-2xl
			border border-gray-300
			shadow-2xl
			flex flex-col
			items-center justify-center
		`;

		// Attach to the SPA root
		const app = document.getElementById('app') as HTMLDivElement;
		app.appendChild(this.element);
	}
	public destroy() {
		if (this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
		// Clear reference for GC
		(this.element as any) = null;
	}
}
