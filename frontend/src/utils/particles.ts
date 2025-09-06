import { tsParticles } from "@tsparticles/engine";
import { loadFull } from "tsparticles";

export async function initParticles() {
	try {
		await loadFull(tsParticles);

		await tsParticles.load({
		id: "tsparticles",
		options: {
			background: { color: "#ebf89eff" },
			fullScreen: { enable: false, zIndex: 0 }, // stays inside container
			fpsLimit: 60,
			particles: {
				number: { value: 3, density: { enable: true, area: 800 } },
				color: { value: "#ff4da6" },
				shape: { type: "circle" },
				opacity: { value: 0.8 },
				size: { value: { min: 20, max: 50 } },
				move: {
					enable: true,
					speed: 2.5,
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
					push: { quantity: 3 },
				},
			},
			detectRetina: true,
		},
		});
	} catch (error) {
		console.error("❌ Error initializing particles:", error);
	}
}
