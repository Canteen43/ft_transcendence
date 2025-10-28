import * as BABYLON from '@babylonjs/core';
import { state } from '../utils/State';
import { conditionalLog } from './Logger';

/**
 * Camera configuration for different player POVs in Pong3D.
 * Handles all camera positioning logic for 2-4 player modes.
 */

export interface CameraPosition {
	alpha: number;
	beta: number;
	radius: number;
	target: BABYLON.Vector3;
}

export interface CameraSettings {
	defaultRadius: number;
	defaultBeta: number;
	defaultTargetY: number;
	useGLBOrigin?: boolean; // If true, force camera target to use GLB origin (0,0,defaultTargetY) instead of mesh center
}

/**
 * Get camera position for a specific player POV
 * @param playerPOV - Which player's perspective (1-4)
 * @param activePlayerCount - How many players are active (2-4)
 * @param settings - Camera configuration settings
 * @param isLocal - Whether this is local 2-player mode (both players on same screen)
 * @returns Camera position configuration
 */
export function getCameraPosition(
	playerPOV: 1 | 2 | 3 | 4,
	activePlayerCount: number,
	settings: CameraSettings,
	isLocal?: boolean
): CameraPosition {
	const { defaultRadius, defaultBeta, defaultTargetY, useGLBOrigin } =
		settings;

	// Helper function to create target vector
	const createTarget = (targetY: number = defaultTargetY) => {
		return useGLBOrigin
			? new BABYLON.Vector3(0, targetY, 0)
			: new BABYLON.Vector3(0, targetY, 0);
	};

	if (state.isMobile === true) {
		// Mobile uses a single angled view per player count to maximize arena visibility.
		const mobileAlpha = 0;
		const adjustBeta = (delta: number) =>
			Math.max(0.4, defaultBeta - delta);

		switch (activePlayerCount) {
			case 2:
				return {
					alpha: Math.PI/2,
					beta: Math.PI / 7, // More overhead angle for better view of both sides
					radius: defaultRadius + 20,// Pulled back further for wider view
					target: createTarget(defaultTargetY - 1),
				};
			case 3:
				return {
					alpha: Math.PI/2,
					beta: Math.PI / 9,// More overhead angle for better view of both sides
					radius: defaultRadius + 27,//Pulled back further for wider view
					target: createTarget(defaultTargetY),
				};
			case 4:
			default:
				return {
					alpha: Math.PI/2,
					beta: Math.PI / 9,// More overhead angle for better view of both sides
					radius: defaultRadius + 42,//Pulled back further for wider view
					target: createTarget(defaultTargetY),
				};
		}
	}

	switch (playerPOV) {
		case 1:
			// Player 1 POV (default - bottom view looking up)
			if (activePlayerCount === 2) {
				if (isLocal) {
					// Local 2-player mode: Use overhead view so both players can see clearly
					return {
						alpha: 0,
						beta: Math.PI / 7, // More overhead angle for better view of both sides
						radius: defaultRadius - 1, // Pulled back further for wider view
						target: createTarget(defaultTargetY + 2), // Slightly elevated target
					};
				} else {
					// Network 2-player mode: Standard view
					return {
						alpha: Math.PI / 2,
						beta: Math.PI / 4.5,
						radius: defaultRadius + 7,
						target: createTarget(defaultTargetY - 1.5),
					};
				}
			} else if (activePlayerCount === 3) {
				return {
					alpha: Math.PI / 2,
					beta: Math.PI / 6,
					radius: defaultRadius + 5.5,
					target: createTarget(defaultTargetY),
				};
			} else {
				// 4-player
				return {
					alpha: Math.PI / 2,
					beta: defaultBeta - 0.8,
					radius: defaultRadius + 15,
					target: createTarget(defaultTargetY - 2),
				};
			}

		case 2:
			// Player 2 POV - depends on player count
			if (activePlayerCount === 2) {
				if (isLocal) {
					// Local 2-player mode: Same overhead view as Player 1 (shared screen)
					return {
						alpha: Math.PI / 2,
						beta: Math.PI / 6, // Same overhead angle
						radius: defaultRadius + 3, // Same pulled back view
						target: createTarget(defaultTargetY + 1), // Same elevated target
					};
				} else {
					// Network 2-player mode: Opposite side (rotated 180°)
					return {
						alpha: (3 * Math.PI) / 2,
						beta: Math.PI / 4.5,
						radius: defaultRadius + 7,
						target: createTarget(defaultTargetY - 1.5),
					};
				}
			} else if (activePlayerCount === 3) {
				// 3-player: Player 2 shares same view as Player 1 for now
				return {
					alpha: Math.PI / 2 + (Math.PI * 2) / 3,
					beta: Math.PI / 7,
					radius: defaultRadius - 1,
					target: createTarget(defaultTargetY + 3),
				};
			} else {
				// 4-player: Player 2 is right side
				return {
					alpha: Math.PI / 2 + Math.PI,
					beta: defaultBeta - 0.1,
					radius: defaultRadius + 2,
					target: createTarget(defaultTargetY + 0.3),
				};
			}

		case 3:
			if (activePlayerCount === 3) {
				return {
					alpha: Math.PI / 2 + (Math.PI * 4) / 3,
					beta: Math.PI / 7,
					radius: defaultRadius - 1,
					target: createTarget(defaultTargetY + 3),
				};
			} else {
				// 4-player: Player 3 is right side
				return {
					alpha: Math.PI / 2 + Math.PI / 2,
					beta: defaultBeta - 0.1,
					radius: defaultRadius + 2,
					target: createTarget(defaultTargetY + 0.3),
				};
			}

		case 4:
			// Player 4 POV (4-player mode only - left side)
			return {
				alpha: Math.PI / 2 - Math.PI / 2,
				beta: defaultBeta - 0.1,
				radius: defaultRadius + 2,
				target: createTarget(defaultTargetY + 0.3),
			};
	}
}

/**
 * Setup camera with specific POV configuration
 * @param camera - Babylon.js ArcRotateCamera to configure
 * @param cameraPos - Camera position configuration
 * @param playerPOV - Current player POV for logging
 */
export function applyCameraPosition(
	camera: BABYLON.ArcRotateCamera,
	cameraPos: CameraPosition,
	playerPOV: number
): void {
	camera.setTarget(cameraPos.target);
	camera.alpha = cameraPos.alpha;
	camera.beta = cameraPos.beta;
	camera.radius = cameraPos.radius;

	conditionalLog(
		`Camera POV switched to Player ${playerPOV}: alpha=${cameraPos.alpha.toFixed(2)}, beta=${cameraPos.beta.toFixed(2)}, radius=${cameraPos.radius.toFixed(2)}, target=(${cameraPos.target.x.toFixed(2)}, ${cameraPos.target.y.toFixed(2)}, ${cameraPos.target.z.toFixed(2)})`
	);
}

/**
 * Default camera settings - SINGLE SOURCE OF TRUTH
 * These values are used by both the POV module and the main Pong3D class
 * Change values here to affect all camera behavior
 */
export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
	defaultRadius: 16,
	defaultBeta: Math.PI / 3,
	defaultTargetY: -3,
	useGLBOrigin: true, // Force camera to use GLB origin instead of calculated mesh center
};
