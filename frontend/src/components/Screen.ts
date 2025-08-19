export class Screen {
	protected element: HTMLDivElement;

	constructor() {
		this.element = document.createElement('div');

		// Tailwind classes for a centered "page" with 85% width & height
		this.element.className = `
            mx-auto my-auto
            w-[85%] h-[85%]
            bg-gray-500
            flex flex-col
            items-center justify-center
        `;

		// Attach to the SPA root
		const app = document.getElementById('app') as HTMLDivElement;
		app.appendChild(this.element);
	}
}
