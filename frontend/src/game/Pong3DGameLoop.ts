import * as BABYLON from '@babylonjs/core';

export interface GameState {
    ball: {
        position: BABYLON.Vector3;
        velocity: BABYLON.Vector3;
    };
    isRunning: boolean;
}

export class Pong3DGameLoop {
    private scene: BABYLON.Scene;
    private ballMesh: BABYLON.Mesh | null = null;
    private gameState: GameState;
    private lastTime: number = 0;
    private originalBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
    private lastCollisionTime: number = 0; // Collision cooldown timer
    private collidableMeshes: BABYLON.AbstractMesh[] = []; // All meshes that can be collided with


    constructor(scene: BABYLON.Scene) {
        this.scene = scene;

        // Initialize game state - will be updated when ball mesh is set
        this.gameState = {
            ball: {
                position: new BABYLON.Vector3(0, 0, 0), // Will be updated to original position
                velocity: this.generateRandomStartingVelocity(5)   // Random starting direction
            },
            isRunning: false
        };
    }

    /**
     * Set the ball mesh reference (called from main Pong3D class)
     */
    setBallMesh(ballMesh: BABYLON.Mesh): void {
        this.ballMesh = ballMesh;

        if (this.ballMesh) {
            // Store the original GLB position (especially the Y value)
            this.originalBallPosition = this.ballMesh.position.clone();

            // Initialize game state position to the original position
            this.gameState.ball.position = this.originalBallPosition.clone();

            console.log(`🎾 Ball original position: ${this.originalBallPosition.toString()}`);
        }
    }

    /**
     * Start the game loop
     */
    start(): void {
        console.log("🎾 Starting Pong3D Game Loop");
        this.gameState.isRunning = true;
        this.lastTime = performance.now();

        // Scan for available collision meshes on start
        this.scanCollisionMeshes();

        // Register the render loop
        this.scene.registerBeforeRender(() => {
            if (this.gameState.isRunning) {
                this.update();
            }
        });
    }

    /**
     * Scan and log all potential collision meshes in the scene
     */
    private scanCollisionMeshes(): void {
        console.log("🔍 Scanning for collision meshes...");
        this.collidableMeshes = []; // Clear the array first

        this.scene.meshes.forEach(mesh => {
            if (!mesh.name || mesh === this.ballMesh) return;

            const name = mesh.name.toLowerCase();
            if (name.startsWith('paddle') || name.startsWith('boundary')) {
                this.collidableMeshes.push(mesh);
            }
        });

        console.log(`🧱 Found ${this.collidableMeshes.length} collidable meshes:`, this.collidableMeshes.map(m => m.name));

        if (this.collidableMeshes.length === 0) {
            console.warn("⚠️ No collidable meshes found! The ball will not bounce off anything.");
        }
    }

    /**
     * Stop the game loop
     */
    stop(): void {
        console.log("⏹️ Stopping Pong3D Game Loop");
        this.gameState.isRunning = false;
    }

    /**
     * Reset ball to center with initial velocity
     */
    resetBall(): void {
        // Reset to center X,Z but keep original Y
        this.gameState.ball.position.set(
            this.originalBallPosition.x,  // Original X (usually 0)
            this.originalBallPosition.y,  // Keep original Y from GLB
            this.originalBallPosition.z   // Original Z (usually 0)
        );

        // Set random starting velocity
        this.gameState.ball.velocity = this.generateRandomStartingVelocity(5);

        if (this.ballMesh) {
            this.ballMesh.position = this.gameState.ball.position.clone();
        }

        console.log(`🔄 Ball reset to original position: ${this.gameState.ball.position.toString()}`);
    }

    /**
     * Main update loop - called every frame
     */
    private update(): void {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Skip if delta time is too large (e.g., when tab was inactive)
        if (deltaTime > 0.1) return;

        this.updateBallPosition(deltaTime);
    }

    /**
     * Update ball position with simple boundary collision detection
     */
    private updateBallPosition(deltaTime: number): void {
        if (!this.ballMesh) return;

        // 🔍 DEBUG: Track velocity at start of frame
        const startVelocity = this.gameState.ball.velocity.clone();
        if (Math.random() < 0.05) { // 5% chance to log
            console.log(`🎬 Frame start velocity: ${startVelocity.toString()}`);
        }

        // Calculate intended new position based on velocity
        const movement = this.gameState.ball.velocity.scale(deltaTime);
        this.gameState.ball.position.addInPlace(movement);

        // 🎯 COLLISION DETECTION
        this.checkCollisions();

        // Update the visual mesh position
        this.ballMesh.position = this.gameState.ball.position.clone();

        // 🔍 DEBUG: Track velocity at end of frame
        const endVelocity = this.gameState.ball.velocity.clone();
        if (Math.random() < 0.05) { // 5% chance to log
            console.log(`🎬 Frame end velocity: ${endVelocity.toString()}`);
            console.log(`🎬 Velocity changed this frame: ${!startVelocity.equals(endVelocity)}`);
        }

        // Simple boundary check for fallback (when no boundary meshes are detected)
        const maxDistance = 20;
        if (Math.abs(this.gameState.ball.position.z) > maxDistance) {
            console.log(`🏓 Ball reached boundary Z: ${this.gameState.ball.position.z.toFixed(2)}`);
            this.resetBall();
        }
    }    /**
     * Get current game state (useful for debugging)
     */
    getGameState(): GameState {
        return {
            ball: {
                position: this.gameState.ball.position.clone(),
                velocity: this.gameState.ball.velocity.clone()
            },
            isRunning: this.gameState.isRunning
        };
    }

    /**
     * Set ball velocity (useful for testing different speeds)
     */
    setBallVelocity(velocity: BABYLON.Vector3): void {
        this.gameState.ball.velocity = velocity.clone();
        console.log(`🎯 Ball velocity set to: ${velocity.toString()}`);
    }

    /**
     * Generate a random starting velocity with configurable speed and angle range
     */
    private generateRandomStartingVelocity(speed: number = 5): BABYLON.Vector3 {
        // Random direction: forward or backward (±1)
        const zDirection = Math.random() < 0.5 ? 1 : -1;

        // Calculate X and Z components
        // Use a limited angle range to keep game playable
        const maxAngle = Math.PI / 3; // 60 degrees max from straight line
        const randomAngle = (Math.random() - 0.5) * 2 * maxAngle; // -60° to +60°

        const x = Math.sin(randomAngle) * speed;
        const z = Math.cos(randomAngle) * speed * zDirection;

        const velocity = new BABYLON.Vector3(x, 0, z);

        console.log(`🎲 Random starting velocity: ${velocity.toString()} (angle: ${(randomAngle * 180 / Math.PI).toFixed(1)}°)`);
        return velocity;
    }

    private checkCollisions(): void {
        if (!this.ballMesh) return;

        const currentTime = performance.now();
        if (currentTime - this.lastCollisionTime < 100) return; // Cooldown

        for (const mesh of this.collidableMeshes) {
            if (this.ballMesh.intersectsMesh(mesh, true)) {
                console.log(`💥 Collision with ${mesh.name}`);

                const normal = this.getCollisionNormal(this.ballMesh, mesh);

                if (normal) {
                    const oldVelocity = this.gameState.ball.velocity.clone();
                    const speed = oldVelocity.length(); // Store original speed

                    this.gameState.ball.velocity = this.calculateReflection(oldVelocity, normal);
                    // Force the exact same speed after collision
                    const currentSpeed = this.gameState.ball.velocity.length();
                    this.gameState.ball.velocity.scaleInPlace(speed / currentSpeed);

                    this.lastCollisionTime = currentTime;

                    // Move ball slightly away from collision point using normalized direction
                    const dir = this.gameState.ball.velocity.clone().normalize();
                    this.gameState.ball.position.addInPlace(dir.scale(0.1));

                    console.log(`   Normal: ${normal.toString()}`);
                    console.log(`   Velocity: ${oldVelocity.toString()} -> ${this.gameState.ball.velocity.toString()}`);
                    break; // Only handle one collision per frame
                }
            }
        }
    }

    private getCollisionNormal(ball: BABYLON.AbstractMesh, collidedMesh: BABYLON.AbstractMesh): BABYLON.Vector3 | null {
        const ballCenter = ball.getAbsolutePosition();

        // Ensure the world matrix is up-to-date for accurate bounding box info
        collidedMesh.computeWorldMatrix(true);
        const boundingBox = collidedMesh.getBoundingInfo().boundingBox;

        const min = boundingBox.minimumWorld;
        const max = boundingBox.maximumWorld;

        // Find the point on the bounding box closest to the ball's center
        const closestPoint = new BABYLON.Vector3(
            Math.max(min.x, Math.min(ballCenter.x, max.x)),
            Math.max(min.y, Math.min(ballCenter.y, max.y)),
            Math.max(min.z, Math.min(ballCenter.z, max.z))
        );

        // The vector from the closest point to the ball's center is our normal
        let normal = ballCenter.subtract(closestPoint);

        if (normal.length() === 0) {
            // The ball's center is exactly on the closest point, which can happen if it's inside.
            // We need to find which face it's exiting.
            const dists = [
                ballCenter.x - min.x,
                max.x - ballCenter.x,
                ballCenter.y - min.y,
                max.y - ballCenter.y,
                ballCenter.z - min.z,
                max.z - ballCenter.z
            ];
            const min_dist = Math.min(...dists);
            const normals = [
                new BABYLON.Vector3(-1, 0, 0), // Left
                new BABYLON.Vector3(1, 0, 0),  // Right
                new BABYLON.Vector3(0, -1, 0), // Bottom
                new BABYLON.Vector3(0, 1, 0),  // Top
                new BABYLON.Vector3(0, 0, -1), // Back
                new BABYLON.Vector3(0, 0, 1)   // Front
            ];
            normal = normals[dists.indexOf(min_dist)];
        }

        return normal.normalize();
    }

    /**
     * Calculate reflected velocity based on surface normal, preserving speed.
     */
    private calculateReflection(velocity: BABYLON.Vector3, normal: BABYLON.Vector3): BABYLON.Vector3 {
        const originalSpeed = velocity.length();

        // Ensure normal is a unit vector
        const normalizedNormal = normal.normalize();

        // Standard reflection formula: v' = v - 2 * (v • n) * n
        const dotProduct = BABYLON.Vector3.Dot(velocity, normalizedNormal);
        const reflectionVector = velocity.subtract(normalizedNormal.scale(2 * dotProduct));

        // Enforce original speed on the new velocity vector to prevent speed loss
        const finalVelocity = reflectionVector.normalize().scale(originalSpeed);

        console.log(`   Speed In: ${originalSpeed.toFixed(3)}, Speed Out: ${finalVelocity.length().toFixed(3)}`);

        return finalVelocity;
    }
}
