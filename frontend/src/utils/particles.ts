// import { tsParticles } from "@tsparticles/engine";
// import { loadFull } from "tsparticles"; // Alternative approach - use the full bundle instead of basic

// export async function initParticles() {
// 	console.log("🎨 Initializing particles with full bundle...");

// 	try {
// 		// Load full bundle (includes everything)
// 		await loadFull(tsParticles);
// 		console.log("📦 Particles full bundle loaded successfully");

// 		// Create particles with full configuration
// 		const container = await tsParticles.load({
// 			id: "tsparticles",
// 			options: {
// 				background: {
// 				color: "#ebf89eff"
// 				},
// 				fullScreen: {
// 				enable: false,
// 				zIndex: 1
// 				},
// 				fpsLimit: 100,
// 				particles: {
// 				number: {
// 					value: 3,
// 					density: {
// 					enable: true,
// 					area: 800
// 					}
// 				},
// 				color: {
// 					value: "#ff4da6"
// 				},
// 				links: {
// 					color: "#ff4da6",
// 					distance: 150,
// 					enable: false,
// 					opacity: 0.6,
// 					width: 1
// 				},
// 				move: {
// 					direction: "none",
// 					enable: true,
// 					outModes: {
// 					default: "bounce"
// 					},
// 					random: false,
// 					speed: 2.5,
// 					straight: false
// 				},
// 				opacity: {
// 					value: 0.8
// 				},
// 				shape: {
// 					type: "circle"
// 				},
// 				size: {
// 					value: { min: 20, max: 50 }
// 				}
// 				},
// 				interactivity: {
// 				detectsOn: "parent",
// 				events: {
// 					onHover: {
// 					enable: true,
// 					mode: "repulse"
// 					},
// 					onClick: {
// 					enable: true,
// 					mode: "push"
// 					},
// 					resize: {
// 					enable: true
// 					}
// 				},
// 				modes: {
// 					repulse: { 
// 						distance: 200,
// 						duration: 0.4
// 					},
// 					push: { 
// 						quantity: 4
// 					}
// 					},
// 				},
// 				detectRetina: true
// 			}
// 		});

// 		if (container) {
// 			console.log("✅ Particles container created successfully");
// 			// Wait for canvas to be ready
// 			// setTimeout(() => {
// 				const canvas = container.canvas.element;
// 				if (canvas) {
// 					// Ensure proper styling
// 						canvas.style.position = 'absolute';
// 						canvas.style.top = '0';
// 						canvas.style.left = '0';
// 						canvas.style.width = '100%';
// 						canvas.style.height = '100%';
// 						canvas.style.pointerEvents = 'auto';
// 						canvas.style.zIndex = '1';
					
// 					// CRITICAL: Ensure the canvas is properly positioned within its container
// 					const parentContainer = canvas.parentElement;
// 					if (parentContainer) {
// 						parentContainer.style.position = 'absolute';
// 						parentContainer.style.top = '0';
// 						parentContainer.style.left = '0';
// 						parentContainer.style.width = '100%';
// 						parentContainer.style.height = '100%';
// 						parentContainer.style.pointerEvents = 'auto';
// 						parentContainer.style.zIndex = '1';
// 					}
					
// 					console.log("🎯 Canvas styling applied");
// 					console.log("Canvas dimensions:", canvas.width, "x", canvas.height);
// 					console.log("Particles count:", container.particles.count);
					
// 					// Test mouse events manually
// 					canvas.addEventListener('mousemove', (e) => {
// 						console.log("🐭 Mouse move detected at:", e.offsetX, e.offsetY);
// 					});
					
// 					canvas.addEventListener('click', (e) => {
// 						console.log("🖱️ Click detected at:", e.offsetX, e.offsetY);
// 					});
				
// 				} else {
// 					console.error("❌ Canvas element not found");
// 				}
// 		// }, 100);
		
// 		} else {
// 			console.error("❌ Failed to create particles container");
// 		}
		
// 		} catch (error) {
// 			console.error("❌ Error initializing particles:", error);
// 			throw error;
// 		}
// }


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
