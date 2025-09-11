/**
 * Pure physics calculation utilities for Pong3D
 * These functions perform calculations without managing meshes or scene state
 */

import * as BABYLON from 'babylonjs';

export class Pong3DPhysicsUtils {
	/**
	 * Calculate collision normal from two mesh positions
	 */
	static calculateCollisionNormal(
		ballPosition: BABYLON.Vector3,
		wallPosition: BABYLON.Vector3
	): BABYLON.Vector3 {
		return ballPosition.subtract(wallPosition).normalize();
	}

	/**
	 * Calculate reflection vector given velocity and normal
	 */
	static calculateReflection(
		velocity: BABYLON.Vector3,
		normal: BABYLON.Vector3,
		restitution: number = 1.0
	): BABYLON.Vector3 {
		const dot = BABYLON.Vector3.Dot(velocity, normal);
		return velocity.subtract(normal.scale(2 * dot * restitution));
	}

	/**
	 * Calculate position correction to prevent mesh embedding
	 */
	static calculatePositionCorrection(
		velocity: BABYLON.Vector3,
		correctionDistance: number
	): BABYLON.Vector3 {
		if (velocity.length() === 0) return BABYLON.Vector3.Zero();
		return velocity.normalize().scale(correctionDistance);
	}

	/**
	 * Check if two spheres are overlapping
	 */
	static areSpheresOverlapping(
		pos1: BABYLON.Vector3,
		radius1: number,
		pos2: BABYLON.Vector3,
		radius2: number
	): { overlapping: boolean; distance: number; separation: number } {
		const distance = BABYLON.Vector3.Distance(pos1, pos2);
		const minSeparation = radius1 + radius2;
		return {
			overlapping: distance < minSeparation,
			distance,
			separation: minSeparation - distance,
		};
	}

	/**
	 * Calculate velocity damping for rapid collision prevention
	 */
	static calculateDampedVelocity(
		velocity: BABYLON.Vector3,
		dampingFactor: number
	): BABYLON.Vector3 {
		return velocity.scale(dampingFactor);
	}

	/**
	 * Constrain position to game bounds
	 */
	static constrainToBounds(
		position: BABYLON.Vector3,
		minBounds: BABYLON.Vector3,
		maxBounds: BABYLON.Vector3
	): BABYLON.Vector3 {
		return new BABYLON.Vector3(
			Math.max(minBounds.x, Math.min(maxBounds.x, position.x)),
			Math.max(minBounds.y, Math.min(maxBounds.y, position.y)),
			Math.max(minBounds.z, Math.min(maxBounds.z, position.z))
		);
	}
}
