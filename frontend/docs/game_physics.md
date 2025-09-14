# Pong 3D Physics - Core Concepts

## Overview
Pong 3D uses **2D physics in 3D space** - all ball movement and collisions occur in the X-Z plane, completely ignoring Y-axis for normals and reflections.

## Core Physics Principles

### 1. X-Z Plane Movement
- **Ball movement**: Always in X-Z plane (Y = 0)
- **Normals**: Collision normals projected to X-Z plane
- **Reflections**: All calculations ignore Y-component
- **Result**: Pure 2D Pong physics in 3D environment

### 2. Paddle States

#### Stationary Paddle (velocity < 0.1)
- **Perfect reflection** with angle limiting
- **2D rotation clamping**: If reflection angle > 60°, rotate toward normal by excess amount
- **Y-forced to 0**: Maintains X-Z plane movement

#### Moving Paddle (velocity ≥ 0.1)
- **Velocity-based control**: Paddle movement influences return angle
- **Spin transfer**: Paddle velocity creates ball spin with Magnus effect
- **Same direction deflection**: Ball deflects in same direction as paddle movement

## Stationary Paddle Physics

### Basic Reflection
```
reflection = ballVelocity - 2 × (ballVelocity · normal) × normal
```

### Angle Limiting (2D Rotation)
1. Calculate perfect reflection
2. Measure angle from normal: `θ = acos(|reflection · normal|)`
3. If θ > 60°: rotate reflection toward normal by (θ - 60°)
4. Force Y = 0, normalize, apply constant speed

### Key Benefits
- **Consistent behavior**: Works regardless of paddle orientation
- **Predictable clamping**: Grazing hits limited to 60° from normal
- **Preserves direction**: Maintains correct left/right deflection

## Moving Paddle Physics

### Angle Effect
- Return angle = (paddleVelocity / maxVelocity) × 60°
- Ball deflects **in same direction** as paddle movement
- Example: Paddle moving right → ball deflects right

### Spin Effect
- Ball spin = paddleVelocity × spinFactor
- Delayed activation (200ms) for straight initial travel
- Magnus force creates curved trajectory
- Spin decays over time (98% per frame)

## Configuration

```typescript
ANGULAR_RETURN_LIMIT = 60°;        // Max reflection angle
VELOCITY_THRESHOLD = 0.1;          // Stationary/moving threshold
BALL_VELOCITY_CONSTANT = 12;       // Constant ball speed
SPIN_TRANSFER_FACTOR = 1.0;        // Paddle velocity → spin conversion
MAGNUS_COEFFICIENT = 0.1;          // Spin force strength
```

## Implementation Notes

### Collision Detection
- Primary: Cannon.js physics engine
- Fallback: Geometric calculation
- Last resort: Hardcoded normals

### Edge Cases Handled
- Ball tunneling prevention with manual bounds checking
- Multiple collision prevention with cooldowns
- Position correction for physics engine limitations

### Player Adjustments
- Player 2: Angle direction inverted
- 3-4 Player modes: Axis rotation for different movement planes
