import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';

/**
 * Pong3DBallEffects - Handles all ball physics effects including spin, Magnus force,
 * rally speed system, and ball velocity management
 */
export class Pong3DBallEffects {
	// Ball spin physics settings
	public SPIN_TRANSFER_FACTOR = 1.0; // How much paddle velocity becomes spin
	public MAGNUS_COEFFICIENT = 0.14; // Strength of Magnus force effect
	public SPIN_DECAY_FACTOR = 0.98; // Spin decay per frame (0.99 = slow decay)
	public SPIN_DELAY = 200; // Delay in milliseconds before spin effect activates

	// Rally speed system
	public RALLY_SPEED_INCREMENT_PERCENT = 10; // Percentage speed increase per paddle hit during rally
	public MAX_BALL_SPEED = 24; // Maximum ball speed to prevent tunneling
	private BALL_VELOCITY_CONSTANT = 12; // Base ball speed
	private currentBallSpeed = 12; // Current ball speed (starts at base speed)
	private rallyHitCount = 0; // Number of paddle hits in current rally

	// Ball state tracking
	private ballSpin: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0); // Current ball spin
	private spinActivationTime: number = 0; // Timestamp when spin was applied
	private spinDelayActive: boolean = false; // Track if we're still in delay period

	// Ball mesh reference (provided by main class)
	private ballMesh: BABYLON.Mesh | null = null;

	constructor(ballVelocityConstant: number = 12) {
		this.BALL_VELOCITY_CONSTANT = ballVelocityConstant;
		this.currentBallSpeed = ballVelocityConstant;
	}

	/** Set the ball mesh reference for physics operations */
	public setBallMesh(ballMesh: BABYLON.Mesh | null): void {
		this.ballMesh = ballMesh;
	}

	/** Reset the rally speed system - called when a new rally starts */
	public resetRallySpeed(): void {
		this.rallyHitCount = 0;
		this.currentBallSpeed = this.BALL_VELOCITY_CONSTANT;
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🔄 Rally speed reset: ${this.currentBallSpeed} units/s`
			);
		}
	}

	/** Increment rally hit count and increase ball speed */
	public incrementRallyHit(): void {
		this.rallyHitCount++;

		// Calculate speed increase
		const speedIncrease =
			(this.BALL_VELOCITY_CONSTANT * this.RALLY_SPEED_INCREMENT_PERCENT) /
			100;
		this.currentBallSpeed = Math.min(
			this.BALL_VELOCITY_CONSTANT + speedIncrease * this.rallyHitCount,
			this.MAX_BALL_SPEED
		);

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🚀 Rally hit #${this.rallyHitCount}: Speed increased to ${this.currentBallSpeed.toFixed(1)} units/s`
			);
		}
	}

	/** Maintain constant ball velocity magnitude while preserving direction */
	public maintainConstantBallVelocity(): void {
		if (!this.ballMesh?.physicsImpostor) return;

		const velocity = this.ballMesh.physicsImpostor.getLinearVelocity();
		if (!velocity) return;

		const currentMagnitude = velocity.length();
		if (currentMagnitude === 0) return;

		// Normalize and scale to current speed
		const normalizedVelocity = velocity.normalize();
		const targetVelocity = normalizedVelocity.scale(this.currentBallSpeed);

		this.ballMesh.physicsImpostor.setLinearVelocity(targetVelocity);
	}

	/** Apply spin to ball based on paddle velocity */
	public applySpinFromPaddle(paddleVelocity: BABYLON.Vector3): void {
		// Transfer some paddle velocity to ball spin
		const spinTransfer = paddleVelocity.scale(this.SPIN_TRANSFER_FACTOR);
		this.ballSpin.addInPlace(spinTransfer);

		// Record when spin was applied for delay system
		this.spinActivationTime = performance.now();
		this.spinDelayActive = true;

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(`🌪️ Spin applied: ${this.ballSpin.toString()}`);
		}
	}

	/** Apply Magnus force effect based on current ball spin */
	public applyMagnusForce(): void {
		if (!this.ballMesh?.physicsImpostor) return;

		// Check if spin delay has elapsed
		const currentTime = performance.now();
		const timeSinceSpinApplied = currentTime - this.spinActivationTime;

		if (timeSinceSpinApplied < this.SPIN_DELAY) {
			// Spin delay period - no Magnus force yet
			if (!this.spinDelayActive && this.spinActivationTime > 0) {
				this.spinDelayActive = true;
				if (GameConfig.isDebugLoggingEnabled()) {
					conditionalLog(
						`🕐 Spin delay active - Magnus effect starts in ${this.SPIN_DELAY}ms`
					);
				}
			}
			return;
		}

		// Check if there's any spin to apply
		const spinMagnitude = this.ballSpin.length();
		if (spinMagnitude < 0.001) return;

		// Log when spin delay period ends (one-time)
		if (this.spinDelayActive) {
			this.spinDelayActive = false;
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`🌪️ Spin delay ended - Magnus effect now active! Spin: ${spinMagnitude.toFixed(3)}`
				);
			}
		}

		// Get current ball velocity
		const velocity = this.ballMesh.physicsImpostor.getLinearVelocity();
		if (!velocity) return;

		// Magnus force = spin × velocity (cross product)
		// This creates a force perpendicular to both spin and velocity
		const magnusForce = BABYLON.Vector3.Cross(this.ballSpin, velocity);

		// Scale the Magnus force by coefficient
		magnusForce.scaleInPlace(this.MAGNUS_COEFFICIENT);

		// CRITICAL FIX: For 2D pong physics, we need Magnus force in X-Z plane
		// The Y-component Magnus force should be converted to X-Z plane deflection
		if (Math.abs(magnusForce.y) > 0.001) {
			// Take the Y magnitude and apply it perpendicular to velocity in X-Z plane
			const velocityXZ = new BABYLON.Vector3(velocity.x, 0, velocity.z);
			if (velocityXZ.length() > 0.001) {
				// Get perpendicular direction to velocity in X-Z plane
				// INVERT the direction to fix the curving direction
				const perpendicular = new BABYLON.Vector3(
					velocityXZ.z, // Changed from -velocityXZ.z
					0,
					-velocityXZ.x // Changed from velocityXZ.x
				).normalize();

				// Apply Magnus force magnitude in perpendicular direction
				// Use original Y magnitude but apply it in X-Z plane
				const magnusForceXZ = perpendicular.scale(magnusForce.y);
				magnusForce.x = magnusForceXZ.x;
				magnusForce.z = magnusForceXZ.z;
			}
		}
		magnusForce.y = 0; // Ensure no Y movement

		// Apply Magnus force as impulse (small continuous force)
		// Scale down the impulse to make it smooth
		const impulseScale = 0.016; // Approximate frame time for 60fps
		magnusForce.scaleInPlace(impulseScale);

		// Apply the impulse to curve the ball's path
		this.ballMesh.physicsImpostor.applyImpulse(
			magnusForce,
			this.ballMesh.position
		);
	}

	/** Reset all ball effects (spin, rally speed, etc.) */
	public resetAllEffects(): void {
		// Reset spin
		this.ballSpin.set(0, 0, 0);
		this.spinActivationTime = 0;
		this.spinDelayActive = false;

		// Reset rally speed
		this.resetRallySpeed();

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(`🔄 All ball effects reset`);
		}
	}

	/** Set ball velocity to a specific value */
	public setBallVelocity(velocity: BABYLON.Vector3): void {
		if (!this.ballMesh?.physicsImpostor) return;
		this.ballMesh.physicsImpostor.setLinearVelocity(velocity);
	}

	// Getters for current state
	public getCurrentBallSpeed(): number {
		return this.currentBallSpeed;
	}

	public getRallyHitCount(): number {
		return this.rallyHitCount;
	}

	public getBallSpin(): BABYLON.Vector3 {
		return this.ballSpin.clone();
	}

	public getRallyInfo(): {
		hitCount: number;
		currentSpeed: number;
		baseSpeed: number;
		speedIncrease: number;
		maxSpeed: number;
	} {
		const speedIncrease =
			this.currentBallSpeed - this.BALL_VELOCITY_CONSTANT;
		return {
			hitCount: this.rallyHitCount,
			currentSpeed: this.currentBallSpeed,
			baseSpeed: this.BALL_VELOCITY_CONSTANT,
			speedIncrease: speedIncrease,
			maxSpeed: this.MAX_BALL_SPEED,
		};
	}

	// Configuration setters
	public setBallVelocityConstant(speed: number): void {
		this.BALL_VELOCITY_CONSTANT = Math.max(1, Math.min(50, speed)); // Clamp between 1 and 50
		this.currentBallSpeed = this.BALL_VELOCITY_CONSTANT;
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`⚽ Ball base speed set to ${this.BALL_VELOCITY_CONSTANT}`
			);
		}
	}

	public setRallySpeedIncrement(percentage: number): void {
		this.RALLY_SPEED_INCREMENT_PERCENT = Math.max(
			0,
			Math.min(100, percentage)
		); // Clamp between 0 and 100
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🏎️ Rally speed increment set to ${this.RALLY_SPEED_INCREMENT_PERCENT}%`
			);
		}
	}

	public setMaxBallSpeed(maxSpeed: number): void {
		this.MAX_BALL_SPEED = Math.max(
			this.BALL_VELOCITY_CONSTANT,
			Math.min(100, maxSpeed)
		); // Clamp between base speed and 100
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🏎️ Maximum ball speed set to ${this.MAX_BALL_SPEED}`
			);
		}
	}

	public setSpinTransferFactor(factor: number): void {
		this.SPIN_TRANSFER_FACTOR = Math.max(0, Math.min(5, factor)); // Clamp between 0 and 5
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🌪️ Spin transfer factor set to ${this.SPIN_TRANSFER_FACTOR}`
			);
		}
	}

	public setMagnusCoefficient(coefficient: number): void {
		this.MAGNUS_COEFFICIENT = Math.max(0, Math.min(1, coefficient)); // Clamp between 0 and 1
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🧲 Magnus coefficient set to ${this.MAGNUS_COEFFICIENT}`
			);
		}
	}

	public setSpinDecayFactor(factor: number): void {
		this.SPIN_DECAY_FACTOR = Math.max(0.9, Math.min(1, factor)); // Clamp between 0.9 and 1
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`⏳ Spin decay factor set to ${this.SPIN_DECAY_FACTOR}`
			);
		}
	}

	public setSpinDelay(delayMs: number): void {
		this.SPIN_DELAY = Math.max(0, Math.min(1000, delayMs)); // Clamp between 0 and 1000ms
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(`⏱️ Spin delay set to ${this.SPIN_DELAY}ms`);
		}
	}

	public applyWallSpinFriction(frictionFactor: number): void {
		this.ballSpin.scaleInPlace(frictionFactor);
	}

	public applySpinDecay(): void {
		this.ballSpin.scaleInPlace(this.SPIN_DECAY_FACTOR);

		// Stop applying spin when it becomes negligible
		if (this.ballSpin.length() < 0.01) {
			this.ballSpin.set(0, 0, 0);
		}
	}
}
