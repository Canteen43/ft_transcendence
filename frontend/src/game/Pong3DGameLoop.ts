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
    private originalBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0); // Store original GLB position
    private previousBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0); // For ray casting
    private lastCollisionTime: number = 0; // Collision cooldown timer

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

            // Initialize previous position for ray casting
            this.previousBallPosition = this.originalBallPosition.clone();

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

        const allMeshes = this.scene.meshes;
        const paddleMeshes: string[] = [];
        const boundaryMeshes: string[] = [];
        const otherMeshes: string[] = [];

        allMeshes.forEach(mesh => {
            if (!mesh.name || mesh === this.ballMesh) return;

            const name = mesh.name.toLowerCase();
            if (name.includes('paddle')) {
                paddleMeshes.push(mesh.name);
            } else if (name.includes('boundary') || name.includes('wall') || name.includes('border') || name.includes('edge')) {
                boundaryMeshes.push(mesh.name);
            } else {
                otherMeshes.push(mesh.name);
            }
        });

        console.log(`🏓 Found ${paddleMeshes.length} paddle meshes:`, paddleMeshes);
        console.log(`🧱 Found ${boundaryMeshes.length} boundary meshes:`, boundaryMeshes);
        console.log(`📦 Found ${otherMeshes.length} other meshes:`, otherMeshes.slice(0, 10)); // Show first 10 only

        if (boundaryMeshes.length === 0) {
            console.warn("⚠️ No boundary meshes found! Ball will only collide with paddles.");
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

        // Reset previous position for clean ray casting
        this.previousBallPosition = this.gameState.ball.position.clone();

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
     * Simple boundary-based collision detection (more reliable than ray casting)
     */
    private checkSimpleBoundaryCollisions(): {
        hit: boolean;
        normal: BABYLON.Vector3;
        newPosition: BABYLON.Vector3;
    } | null {
        const pos = this.gameState.ball.position;
        const ballRadius = 0.1;

        // Court boundaries (adjust these based on your court size)
        const bounds = {
            minX: -5.0,
            maxX: 5.0,
            minZ: -9.0,
            maxZ: 9.0
        };

        let hitNormal: BABYLON.Vector3 | null = null;
        let newPos = pos.clone();

        // Check X boundaries (left/right walls)
        if (pos.x <= bounds.minX + ballRadius) {
            hitNormal = new BABYLON.Vector3(1, 0, 0); // Normal pointing right
            newPos.x = bounds.minX + ballRadius + 0.1; // Push away from wall
            console.log(`🧱 Hit LEFT wall at X=${pos.x}`);
        } else if (pos.x >= bounds.maxX - ballRadius) {
            hitNormal = new BABYLON.Vector3(-1, 0, 0); // Normal pointing left
            newPos.x = bounds.maxX - ballRadius - 0.1; // Push away from wall
            console.log(`🧱 Hit RIGHT wall at X=${pos.x}`);
        }

        // NO Z boundaries - paddles handle front/back collisions

        if (hitNormal) {
            return {
                hit: true,
                normal: hitNormal,
                newPosition: newPos
            };
        }

        return null;
    }

    /**
     * Check for paddle collisions using ray casting
     */
    private checkPaddleCollisions(): {
        hit: boolean;
        normal: BABYLON.Vector3;
        newPosition: BABYLON.Vector3;
        mesh: BABYLON.AbstractMesh;
    } | null {
        if (!this.ballMesh) return null;

        const currentPos = this.gameState.ball.position;
        const previousPos = this.previousBallPosition;

        // Create ray from previous position to current position
        const direction = currentPos.subtract(previousPos);
        const distance = direction.length();

        if (distance === 0) return null; // No movement

        const normalizedDirection = direction.normalize();
        const ray = new BABYLON.Ray(previousPos, normalizedDirection, distance);

        // 🔍 DEBUG: Log paddle detection attempt
        if (Math.random() < 0.1) { // 10% chance to log
            console.log(`🔍 Checking paddle collisions:`);
            console.log(`   From: ${previousPos.toString()}`);
            console.log(`   To: ${currentPos.toString()}`);
            console.log(`   Distance: ${distance.toFixed(3)}`);

            // List all meshes with "paddle" in the name
            const paddleMeshes = this.scene.meshes.filter(mesh =>
                mesh.name.toLowerCase().includes('paddle')
            );
            console.log(`   Available paddle meshes: ${paddleMeshes.map(m => m.name).join(', ')}`);
        }

        // Use scene.pickWithRay to find intersections
        const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
            // Only check meshes that have "paddle" in their name
            return mesh.name.toLowerCase().includes('paddle');
        });

        if (pickInfo?.hit && pickInfo.pickedMesh && pickInfo.pickedPoint && pickInfo.getNormal()) {
            const ballRadius = 0.1;
            const normal = pickInfo.getNormal()!.normalize();

            // Position ball safely away from paddle surface
            const safePosition = pickInfo.pickedPoint.subtract(normal.scale(ballRadius + 0.1));

            console.log(`🏓 Ball hit paddle: ${pickInfo.pickedMesh.name}`);
            console.log(`   At point: ${pickInfo.pickedPoint.toString()}`);
            console.log(`   Normal: ${normal.toString()}`);

            return {
                hit: true,
                normal: normal,
                newPosition: safePosition,
                mesh: pickInfo.pickedMesh
            };
        }

        return null;
    }

    /**
     * Simple bounding box collision check for paddles (fallback method)
     */
    private checkPaddleBoundingBoxCollisions(): {
        hit: boolean;
        normal: BABYLON.Vector3;
        newPosition: BABYLON.Vector3;
        mesh: BABYLON.AbstractMesh;
    } | null {
        const ballPos = this.gameState.ball.position;
        const ballRadius = 0.15; // Slightly larger for bounding box detection

        // Find all paddle meshes
        const paddleMeshes = this.scene.meshes.filter(mesh =>
            mesh.name.toLowerCase().includes('paddle')
        );

        for (const paddle of paddleMeshes) {
            if (!paddle.getBoundingInfo) continue;

            const boundingInfo = paddle.getBoundingInfo();
            const min = boundingInfo.boundingBox.minimumWorld;
            const max = boundingInfo.boundingBox.maximumWorld;

            // Check if ball is within paddle's bounding box (with radius)
            if (ballPos.x >= min.x - ballRadius && ballPos.x <= max.x + ballRadius &&
                ballPos.y >= min.y - ballRadius && ballPos.y <= max.y + ballRadius &&
                ballPos.z >= min.z - ballRadius && ballPos.z <= max.z + ballRadius) {

                console.log(`📦 Bounding box collision with paddle: ${paddle.name}`);
                console.log(`   Ball at: ${ballPos.toString()}`);
                console.log(`   Paddle bounds: ${min.toString()} to ${max.toString()}`);

                // Determine which face of the paddle was hit based on ball position
                const paddleCenter = boundingInfo.boundingBox.centerWorld;
                const diff = ballPos.subtract(paddleCenter);

                let normal: BABYLON.Vector3;
                let newPos = ballPos.clone();

                // Find the axis with the largest difference to determine collision face
                const absDiff = new BABYLON.Vector3(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));

                if (absDiff.z > absDiff.x && absDiff.z > absDiff.y) {
                    // Hit front or back face
                    normal = new BABYLON.Vector3(0, 0, diff.z > 0 ? 1 : -1);
                    newPos.z = diff.z > 0 ? max.z + ballRadius + 0.1 : min.z - ballRadius - 0.1;
                } else if (absDiff.x > absDiff.y) {
                    // Hit left or right face
                    normal = new BABYLON.Vector3(diff.x > 0 ? 1 : -1, 0, 0);
                    newPos.x = diff.x > 0 ? max.x + ballRadius + 0.1 : min.x - ballRadius - 0.1;
                } else {
                    // Hit top or bottom face
                    normal = new BABYLON.Vector3(0, diff.y > 0 ? 1 : -1, 0);
                    newPos.y = diff.y > 0 ? max.y + ballRadius + 0.1 : min.y - ballRadius - 0.1;
                }

                console.log(`   Collision normal: ${normal.toString()}`);

                return {
                    hit: true,
                    normal: normal,
                    newPosition: newPos,
                    mesh: paddle
                };
            }
        }

        return null;
    }

    /**
 * Calculate reflected velocity based on surface normal
 */
    private calculateReflection(velocity: BABYLON.Vector3, normal: BABYLON.Vector3): BABYLON.Vector3 {
        console.log(`🔧 Reflection calculation:`);
        console.log(`   Input velocity: ${velocity.toString()}`);
        console.log(`   Surface normal: ${normal.toString()}`);
        console.log(`   Normal length: ${normal.length()}`);

        // Ensure normal is normalized
        const normalizedNormal = normal.normalize();
        console.log(`   Normalized normal: ${normalizedNormal.toString()}`);

        // Physics formula: reflection = velocity - 2 * (velocity • normal) * normal
        const dotProduct = BABYLON.Vector3.Dot(velocity, normalizedNormal);
        console.log(`   Dot product: ${dotProduct}`);

        const reflection = velocity.subtract(normalizedNormal.scale(2 * dotProduct));
        console.log(`   Raw reflection: ${reflection.toString()}`);

        // Keep the same speed (magnitude) but change direction
        const originalSpeed = velocity.length();
        const finalReflection = reflection.normalize().scale(originalSpeed);

        console.log(`   Original speed: ${originalSpeed}`);
        console.log(`   Final reflection: ${finalReflection.toString()}`);

        return finalReflection;
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

        // Store current position as previous for next frame
        this.previousBallPosition = this.gameState.ball.position.clone();

        // Calculate intended new position based on velocity
        const movement = this.gameState.ball.velocity.scale(deltaTime);
        this.gameState.ball.position.addInPlace(movement);

        // 🎯 COLLISION DETECTION: Check boundaries and paddles after movement
        const boundaryCollision = this.checkSimpleBoundaryCollisions();
        let paddleCollision = this.checkPaddleCollisions();

        // If ray casting didn't find paddle collision, try bounding box detection
        if (!paddleCollision) {
            paddleCollision = this.checkPaddleBoundingBoxCollisions();
        }

        // 🛡️ COLLISION COOLDOWN: Prevent rapid repeated collisions
        const currentTime = performance.now();
        const timeSinceLastCollision = currentTime - this.lastCollisionTime;
        const collisionCooldown = 100; // 100ms minimum between collisions

        // Handle boundary collisions (side walls)
        if (boundaryCollision && timeSinceLastCollision > collisionCooldown) {
            console.log(`💥 Boundary collision detected!`);
            this.lastCollisionTime = currentTime;

            // Position ball at safe location
            this.gameState.ball.position = boundaryCollision.newPosition;

            // Reflect velocity
            const oldVelocity = this.gameState.ball.velocity.clone();
            this.gameState.ball.velocity = this.calculateReflection(oldVelocity, boundaryCollision.normal);

            console.log(`🎾 Velocity: ${oldVelocity.toString()} → ${this.gameState.ball.velocity.toString()}`);
        }
        // Handle paddle collisions (front/back)
        else if (paddleCollision && timeSinceLastCollision > collisionCooldown) {
            console.log(`🏓 Paddle collision detected with ${paddleCollision.mesh.name}!`);
            this.lastCollisionTime = currentTime;

            // Position ball at safe location
            this.gameState.ball.position = paddleCollision.newPosition;

            // Reflect velocity
            const oldVelocity = this.gameState.ball.velocity.clone();
            this.gameState.ball.velocity = this.calculateReflection(oldVelocity, paddleCollision.normal);

            console.log(`🎾 Velocity: ${oldVelocity.toString()} → ${this.gameState.ball.velocity.toString()}`);
        }

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
}
