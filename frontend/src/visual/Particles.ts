import { tsParticles } from "@tsparticles/engine";
import { loadFull } from "tsparticles";

export async function initParticles() {
	try {
		await loadFull(tsParticles);

		await tsParticles.load({
		id: "tsparticles",
		options: {
			background: { color: "#0d1453ff" },
			fullScreen: { enable: false, zIndex: 0 }, // stays inside container
			fpsLimit: 60,
			particles: {
				number: { value: 30, density: { enable: true } },
				color: { value: "#f8f7abff" },
				shape: { type: "circle" },
				opacity: { value: 0.8 },
				size: { value: { min: 2, max: 10 } },
				move: {
					enable: true,
					speed: 0.3,
					direction: "none",
					outModes: { default: "bounce" },
				},
			},
			interactivity: {
				events: {
					onHover: { enable: true, mode: "repulse" },
					onClick: { enable: true, mode: "push" },
				},
				modes: {
					repulse: { distance: 200, duration: 0.4 },
					push: { quantity: 10 },
				},
			},
			detectRetina: true,
		},
		});
	} catch (error) {
		console.error("❌ Error initializing particles:", error);
	}
}


export	function createParticlesBackground(parent: HTMLElement) {
		const particlesContainer = document.createElement('div');
		particlesContainer.id = "tsparticles";

		Object.assign(particlesContainer.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '100vw',
			height: '100vh',
			zIndex: '-10', 
			pointerEvents: 'none'
		});

		parent.prepend(particlesContainer);
	}
