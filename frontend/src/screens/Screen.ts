// import { HomeButton } from '../buttons/HomeButton';
// import { Banner } from '../utils/Banner';

// export class Screen {
// 	public element: HTMLDivElement;
// 	protected homeButton?: HomeButton;
// 	protected banner?: Banner;

// 	constructor(showHomeButton: boolean = true) {
// 		this.element = document.createElement('div');
// 		this.element.className = `
// 			mx-auto my-auto
// 			w-full h-full
// 			bg-gray-800/80
// 			shadow-2xl
// 			flex flex-col
// 			items-center justify-center
// 		`;

// 		// Attach to the SPA root
// 		const app = document.getElementById('app') as HTMLDivElement;
// 		app.appendChild(this.element);

// 		// Add home button to screens that need it (not on HomeScreen itself)
// 		if (showHomeButton) {
// 			this.homeButton = new HomeButton(app);
// 		}
// 		this.banner = new Banner(app);
// 		document.addEventListener('login-success', this.handleLogin);
// 		document.addEventListener('logout-success', this.handleLogout);
// 		document.addEventListener('login-failed', this.handleLogout);
// 	}

// 	private handleLogin = () => {
// 		// Create banner on login if this screen wants one
// 		if (!this.banner) {
// 			const app = document.getElementById('app') as HTMLDivElement;
// 			this.banner = new Banner(app);
// 		}
// 	};

// 	private handleLogout = () => {
// 		// Remove banner on logout
// 		if (this.banner) {
// 			this.banner.destroy();
// 			this.banner = undefined;
// 		}
// 	};

// 	public destroy(): void {
// 		// Remove event listeners
// 		document.removeEventListener('login-success', this.handleLogin);
// 		document.removeEventListener('logout-success', this.handleLogout);
// 		document.addEventListener('login-failed', this.handleLogout);

// 		// Clean up banner
// 		if (this.banner) {
// 			this.banner.destroy();
// 			this.banner = undefined;
// 		}

// 		// Clean up home button
// 		if (this.homeButton) {
// 			this.homeButton.destroy();
// 			this.homeButton = undefined;
// 		}

// 		// Clean up screen element
// 		this.element.parentNode?.removeChild(this.element);
// 		this.element.replaceChildren();
// 		this.element = null as any;
// 	}
// }


import { HomeButton } from '../buttons/HomeButton';
import { Banner } from '../utils/Banner';

export class Screen {
	public element: HTMLDivElement;
	protected homeButton?: HomeButton;
	protected banner?: Banner;
	private static instanceCount = 0;
	private instanceId: number;

	constructor(showHomeButton: boolean = true) {
		this.instanceId = ++Screen.instanceCount;
		console.time(`🖼️ Screen#${this.instanceId} Constructor`);
		
		console.log(`🖼️ Screen#${this.instanceId}: Creating element...`);
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
		console.log(`🖼️ Screen#${this.instanceId}: Attaching to DOM...`);
		const app = document.getElementById('app') as HTMLDivElement;
		app.appendChild(this.element);

		// Add home button to screens that need it (not on HomeScreen itself)
		if (showHomeButton) {
			console.log(`🖼️ Screen#${this.instanceId}: Creating home button...`);
			this.homeButton = new HomeButton(app);
		}
		
		console.log(`🖼️ Screen#${this.instanceId}: Creating banner...`);
		this.banner = new Banner(app);
		
		console.log(`🖼️ Screen#${this.instanceId}: Adding event listeners...`);
		document.addEventListener('login-success', this.handleLogin);
		document.addEventListener('logout-success', this.handleLogout);
		document.addEventListener('login-failed', this.handleLogout);
		
		console.timeEnd(`🖼️ Screen#${this.instanceId} Constructor`);
	}

	private handleLogin = () => {
		// Create banner on login if this screen wants one
		if (!this.banner) {
			const app = document.getElementById('app') as HTMLDivElement;
			this.banner = new Banner(app);
		}
	};

	private handleLogout = () => {
		// Remove banner on logout
		if (this.banner) {
			this.banner.destroy();
			this.banner = undefined;
		}
	};

	public destroy(): void {
		console.time(`🧹 Screen#${this.instanceId} Destroy`);
		console.log(`🧹 Screen#${this.instanceId}: Starting destruction...`);
		
		// Remove event listeners
		console.log(`🧹 Screen#${this.instanceId}: Removing event listeners...`);
		document.removeEventListener('login-success', this.handleLogin);
		document.removeEventListener('logout-success', this.handleLogout);
		document.removeEventListener('login-failed', this.handleLogout);

		// Clean up banner
		if (this.banner) {
			console.log(`🧹 Screen#${this.instanceId}: Destroying banner...`);
			this.banner.destroy();
			this.banner = undefined;
		}

		// Clean up home button
		if (this.homeButton) {
			console.log(`🧹 Screen#${this.instanceId}: Destroying home button...`);
			this.homeButton.destroy();
			this.homeButton = undefined;
		}

		// Clean up screen element
		console.log(`🧹 Screen#${this.instanceId}: Removing from DOM...`);
		if (this.element && this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
		
		console.log(`🧹 Screen#${this.instanceId}: Clearing children...`);
		if (this.element) {
			this.element.replaceChildren();
			this.element = null as any;
		}
		
		console.timeEnd(`🧹 Screen#${this.instanceId} Destroy`);
		console.log(`✅ Screen#${this.instanceId}: Fully destroyed`);
	}
}