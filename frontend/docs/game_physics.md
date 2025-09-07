# Pong 3D Game Physics Documentation

## Overview

This document defines the physics behavior for ball-paddle collisions in Pong 3D. The system aims to provide realistic and controllable ball physics while preventing extreme angles that could lead to poor gameplay.

## Core Physics Principles

### 1. Collision Normal Detection
- **Primary Method**: Use Cannon.js collision detection to get the true surface normal at collision point
- **Fallback**: Geometric calculation from paddle mesh if Cannon.js fails
- **Last Resort**: Hardcoded normals based on paddle orientation

### 2. Paddle States
The system recognizes two distinct paddle states:

#### A. Stationary Paddle (velocity < threshold)
- **Threshold**: `VELOCITY_THRESHOLD = 0.1` units/frame
- **Behavior**: Pure physics reflection with angle limiting

#### B. Moving Paddle (velocity ≥ threshold)
- **Behavior**: Velocity-based ball control with two effects:
  1. **Angle Effect**: Paddle velocity influences return angle
  2. **Spin Effect**: Paddle velocity creates ball spin

## Detailed Physics Behavior

### Stationary Paddle Physics

When paddle velocity is below the threshold:

1. **Calculate Perfect Reflection**:
   ```
   reflection = ballVelocity - 2 * dot(ballVelocity, normal) * normal
   ```

2. **Check Angular Limit**:
   - Calculate incoming angle from normal: `acos(|dot(ballVel, normal)|)`
   - If incoming angle > (90° - ANGULAR_RETURN_LIMIT), it's a grazing hit

3. **Apply Result**:
   - **Normal hits**: Use perfect reflection
   - **Grazing hits**: Clamp return angle to exactly ANGULAR_RETURN_LIMIT from normal

### Moving Paddle Physics

When paddle velocity is at or above the threshold:

### Moving Paddle Physics

When paddle velocity is at or above the threshold:

1. **Angle Effect** (Direct Proportional Control):
   - Calculate velocity ratio: `paddleVel / PADDLE_MAX_VELOCITY` (clamped to ±1.0)
   - Calculate return angle: `velocityRatio * ANGULAR_RETURN_LIMIT`
   - **Key Physics**: Ball deflects **IN THE SAME DIRECTION** as paddle movement
   
   **Examples**:
   - Moving left at max velocity (ratio = -1.0) → Ball deflects LEFT at max angle (-60°)
   - Moving right at max velocity (ratio = +1.0) → Ball deflects RIGHT at max angle (+60°)
   - Moving right at half velocity (ratio = +0.5) → Ball deflects RIGHT at half angle (+30°)
   - Stationary (ratio = 0.0) → No angular deflection (0°)

2. **Spin Effect** (Delayed Magnus Force):
   - Ball spin = `paddleVelocity * SPIN_TRANSFER_FACTOR`
   - Spin activation delayed by `SPIN_DELAY` milliseconds
   - During delay: Ball travels straight
   - After delay: Magnus force creates curved trajectory
   - Spin decays over time: `spin *= SPIN_DECAY_FACTOR` per frame

## Configuration Parameters

### Angular Limits
```typescript
ANGULAR_RETURN_LIMIT = Math.PI / 3; // 60 degrees from normal
```
- Maximum allowed return angle from paddle normal
- Prevents extreme grazing returns that cause wall-bouncing

### Velocity Thresholds
```typescript
VELOCITY_THRESHOLD = 0.1;           // Minimum velocity for "moving" paddle
PADDLE_MAX_VELOCITY = 12;           // Maximum paddle speed for calculations
```

### Ball Physics
```typescript
BALL_VELOCITY_CONSTANT = 12;        // Constant ball speed
BALL_ANGLE_MULTIPLIER = 1.0;        // Strength of angle influence (0-2)
```

### Spin Physics
```typescript
SPIN_TRANSFER_FACTOR = 1.0;         // How much paddle velocity becomes spin
MAGNUS_COEFFICIENT = 0.1;           // Strength of Magnus force effect  
SPIN_DECAY_FACTOR = 0.98;           // Spin decay per frame
SPIN_DELAY = 200;                   // Delay in ms before spin effect activates
```

## Physics Flow Diagram

```
Ball Hits Paddle
       ↓
Get Collision Normal (Cannon.js → Geometric → Hardcoded)
       ↓
Check Paddle Velocity
       ↓
   ┌─────────────────────┐
   ↓                     ↓
STATIONARY           MOVING
   ↓                     ↓
Calculate Perfect    Calculate Velocity-Based
Reflection           Return Direction
   ↓                     ↓
Check if Grazing     Apply Angle Effect
Hit (angle limit)    (rotate normal by velocity ratio)
   ↓                     ↓
Normal Hit: Use      Apply Spin Effect
Perfect Reflection   (spin = paddle velocity)
   ↓                     ↓
Grazing Hit: Clamp   Set Ball Velocity
to Angular Limit     (constant speed)
       ↓                 ↓
    ┌──────────────────────┐
    ↓
Set Ball Velocity (constant speed)
    ↓
Apply Magnus Force (if spin exists)
    ↓
Decay Spin Over Time
```

## Expected Behaviors

### Stationary Paddle Examples

1. **Head-on collision** (ball → normal):
   - Return: Perfect reflection (ball ← normal)
   - No angle limiting needed

2. **45° collision** (within limit):
   - Return: Perfect 45° reflection
   - No angle limiting applied

3. **75° collision** (grazing hit):
   - Perfect reflection would be ~165° (too steep)
   - Return: Clamped to exactly 30° from normal
   - Preserves collision "side" but limits steepness

### Moving Paddle Examples

1. **Stationary ball, paddle moving right**:
   - Return: Ball deflected right at angle proportional to paddle speed
   - Spin: Clockwise spin applied (Magnus effect curves ball)

2. **Ball from left, paddle moving right**:
   - Return: Enhanced rightward deflection (additive effect)
   - Spin: Strong clockwise spin

3. **Ball from right, paddle moving right**:
   - Return: Reduced rightward deflection (opposing effect)
   - Spin: Clockwise spin still applied

## Implementation Notes

### Player-Specific Adjustments
- **Player 2 (top paddle)**: Angle direction inverted for consistent control
- **3-Player mode**: Each paddle has rotated movement axis
- **4-Player mode**: Players 3-4 move on Z-axis instead of X-axis

### Collision Validation
- Edge collision detection prevents weird bounces
- Position correction prevents ball pass-through
- Collision cooldowns prevent multiple triggers

### Physics Integration
- Constant ball speed maintenance
- Magnus force application for spin effects
- Spin decay simulation
- Wall collision spin reduction

## Debugging Features

### Console Logging
- Collision normal values
- Paddle velocity states
- Angle calculations
- Spin values
- Clamping events

### Visual Indicators
- Real-time paddle velocity display
- Ball spin visualization (if enabled)
- Collision point highlighting (if enabled)

## Tuning Guidelines

### For More Realistic Physics
- Increase `SPIN_TRANSFER_FACTOR` and `MAGNUS_COEFFICIENT`
- Decrease `ANGULAR_RETURN_LIMIT` for stricter angle limiting

### For More Arcade-Style
- Increase `BALL_ANGLE_MULTIPLIER` for stronger paddle control
- Increase `ANGULAR_RETURN_LIMIT` for more forgiving grazing hits

### For Faster Gameplay
- Increase `BALL_VELOCITY_CONSTANT`
- Increase `PADDLE_MAX_VELOCITY`
- Decrease spin decay for longer-lasting effects
