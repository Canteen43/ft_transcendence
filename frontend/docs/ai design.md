# Pong3D AI Design Document

## Overview

This document outlines the design for an AI system in Pong3D that allows computer-controlled players in local multiplayer games. The AI is designed as a pe### Advanced AI Features

- **Ball Trajectory Prediction**: Calculate interception points using ball position and velocity vectors
- **Ray Casting Algorithm**: Cast rays along ball trajectory, accounting for court boundaries and reflections
- **Predictive Positioning**: Move paddle toward predicted ball crossing point rather than current position
- **Multi-bounce Prediction**: Handle balls that bounce multiple times before reaching paddle
- **Opponent Modeling**: Learn human player patterns
- **Cooperative AI**: Coordinate with other AI players
- **Adaptive Difficulty**: Adjust parameters based on player performanceical exercise to demonstrate basic AI concepts while maintaining game balance and fairness.

## Game Mechanics

The AI design assumes the following game mechanics:

- The ball moves only in the x-z plane.
- Paddles move only along the x-axis.
- The AI logic is currently implemented only for 2-player mode.

## Core Concept

AI players are identified by player names that begin with an asterisk (`*`). When a player name starts with `*`, that player slot becomes AI-controlled instead of requiring human input.

**Equal Tools Principle**: AI players have access to exactly the same input system as human players - only left/right/stop paddle controls. No special speed advantages, physics modifications, or enhanced capabilities. Difficulty is controlled purely through timing and decision-making parameters.

## AI Architecture

### Sample-Based Control

- **Sample Rate**: Configurable sampling frequency (default: 1 Hz / once per second)
- **Difficulty Tuning**: Lower sample rates = easier AI (more predictable), higher rates = harder AI (more responsive)
- **Real-time Processing**: AI decisions are made at sample intervals, not continuously

### Input System

The AI has access to **exactly the same 3-input system as human players**:

- **Left**: Move paddle left
- **Right**: Move paddle right
- **Stop**: No movement (neutral position)

**Input Duration Control**: Each AI input is limited to a configurable duration to prevent overshooting. Instead of holding inputs for the full sample interval, AI provides short "pulses" of movement that result in the same physics response as human inputs.

### Decision Algorithm

#### 2-Player Mode

For 2-player games, the AI uses a simple **ball-tracking algorithm**:

1. **Sample ball position** at configured intervals
2. **Extract X-coordinate** of ball position
3. **Compare to paddle X-position**
4. **Apply deadzone and boundary logic**:
    - If ball X is within `central_limit` of paddle X → **Stop**
    - If ball X is left of paddle X AND paddle X > -x_limit → **Left**
    - If ball X is right of paddle X AND paddle X < x_limit → **Right**
    - Otherwise → **Stop**

#### Multi-Player Modes (3-4 Players)

Future extension possibilities:

- Track ball trajectory prediction
- Prioritize based on ball direction
- Coordinate with other AI players

## Configuration Parameters

### AI_Sample_Rate

- **Type**: `number` (Hz)
- **Default**: `1.0`
- **Range**: `0.1` to `10.0`
- **Description**: How often AI samples game state (samples per second)
- **Difficulty Impact**: Higher values = more responsive/faster AI

### AI_Central_Limit

- **Type**: `number` (units)
- **Default**: `0.5`
- **Range**: `0.1` to `2.0`
- **Description**: Deadzone radius where AI doesn't move paddle
- **Difficulty Impact**: Larger values = more forgiving AI positioning

### AI_Input_Duration_Base

- **Type**: `number` (milliseconds)
- **Default**: `300`
- **Range**: `50` to `1000`
- **Description**: Base duration for input pulses when paddle is far from target
- **Difficulty Impact**: Longer base duration = more aggressive movement

### AI_Input_Duration_Scale

- **Type**: `number` (multiplier)
- **Default**: `2.0`
- **Range**: `0.5` to `5.0`
- **Description**: How much pulse duration scales with distance to target
- **Difficulty Impact**: Higher values = longer pulses for large corrections

### AI_X_Limit

- **Type**: `number` (units)
- **Default**: `5.0`
- **Range**: `1.0` to `10.0`
- **Description**: Maximum X-coordinate limit for paddle movement (symmetric around center, paddle X constrained to [-x_limit, x_limit])
- **Difficulty Impact**: Smaller values = more restricted AI movement range, larger values = wider paddle coverage

## Implementation Plan

### Phase 1: Core AI System

1. **Create pong3DAI.ts**: Dedicated AI module for clean separation of concerns
2. **AI Detection**: Check player names for `*` prefix during game initialization
3. **Input Override**: Replace human input with AI decisions for AI players
4. **Basic Tracking**: Implement X-coordinate ball tracking with boundary limits for 2-player mode
5. **Sample Timer**: Implement configurable sampling system

### Phase 2: Advanced Features

1. **Trajectory Prediction**: Calculate ball future position based on velocity vector and court geometry
2. **Ray Casting**: Cast rays along ball trajectory to predict reflection points
3. **Interception Calculation**: Determine optimal paddle position for ball interception
4. **Predictive Control**: Move toward predicted interception point rather than current ball position
5. **Adaptive Deadzone**: Adjust deadzone based on ball speed/distance
6. **Human-like Behavior**: Add slight delays and imperfections
7. **Multi-player Support**: Extend algorithm for 3-4 player courts

### Phase 3: Balancing & Tuning

1. **Difficulty Presets**: Easy/Medium/Hard configurations
2. **Performance Testing**: Ensure AI doesn't impact game performance
3. **Balance Validation**: Test against human players

## Technical Implementation

### pong3DAI.ts Structure

## File Structure

### pong3DAI.ts

Main AI module containing:

- `Pong3DAI` class: Core AI controller with pulse-based input system
- `AIConfig` interface: Configuration parameters for AI behavior
- `AIInput` enum: Left/Right/Stop input states
- Helper functions for trajectory calculations (Phase 2)

### Integration Points

- **GameConfig**: Add AI configuration options
- **InputHandler**: Override input for AI players
- **GameLoop**: Provide game state to AI controllers
- **UI**: Visual indicators for AI players

## Pedagogical Value

This AI design demonstrates several fundamental AI concepts:

1. **Sample-Based Decision Making**: Real-world AI often works with periodic sensor data
2. **Pulse Control Systems**: Short input bursts rather than continuous control (prevents overshoot)
3. **Proportional Control**: Pulse duration scales with error magnitude (distance to target)
4. **Temporal State Management**: Tracking input timing and duration
5. **Control Theory**: PID-like control with deadzones and proportional response
6. **State Estimation**: Tracking relevant game state variables
7. **Difficulty Balancing**: Using timing parameters to control challenge
8. **Equal Tools Constraint**: AI must work within the same limitations as humans
9. **Resource Constraints**: Limited inputs force creative solutions

## Benefits of Pulse-Based Input

The pulse-based input system provides several advantages:

- **Proportional Control**: Pulse duration scales with distance - small corrections get short pulses, large corrections get longer pulses
- **Prevents Overshoot**: Short pulses for close targets, longer pulses for distant targets
- **Human-like Behavior**: Mimics how humans make quick corrections when close, sustained movements when far
- **Configurable Precision**: Multiple parameters allow fine-tuning of AI responsiveness
- **Smooth Gameplay**: Reduces jerky paddle movement through intelligent pulse timing
- **Adaptive Movement**: AI moves faster when far from target, slows down as it approaches

## Trajectory Prediction Enhancement

### Algorithm Overview

For advanced AI that can handle Pong's physics more intelligently:

1. **Ball Vector Analysis**: Access ball position and velocity vectors
2. **Ray Casting**: Project ball trajectory line from current position along velocity vector
3. **Boundary Detection**: Calculate intersection points with court boundaries (walls, goals)
4. **Reflection Calculation**: Apply physics reflection rules at boundary intersections
5. **Interception Prediction**: Determine where ball will cross the paddle's baseline
6. **Optimal Positioning**: Calculate ideal paddle X-position for interception
7. **Proportional Movement**: Use pulse system to move toward predicted position

### Implementation Example

### Benefits

- **Perfect Defense**: AI can position for balls it couldn't reach with reactive control
- **Strategic Play**: Can predict ball paths around obstacles (in 3-4 player modes)
- **Human-like Skill**: Demonstrates expert-level paddle positioning
- **Scalable Difficulty**: Can be tuned from basic reactive to perfect prediction

## Future Enhancements

### Advanced AI Features

- **Ball Trajectory Prediction**: Calculate interception points
- **Opponent Modeling**: Learn human player patterns
- **Cooperative AI**: Coordinate between multiple AI players
- **Adaptive Difficulty**: Adjust parameters based on player performance

### Game Modes

- **AI vs AI**: Spectate computer players
- **Mixed Teams**: Human + AI combinations
- **Training Mode**: Practice against progressively harder AI

## Testing & Validation

### Unit Tests

- AI decision logic accuracy
- Sample rate timing precision
- Deadzone boundary conditions

### Integration Tests

- AI player initialization
- Input override functionality
- Performance impact measurement

### Playtesting

- Difficulty curve validation
- Human vs AI balance testing
- Multi-player scenario testing

## Conclusion

This AI design provides a solid foundation for computer-controlled players while serving as an excellent educational tool. The simple yet effective algorithm demonstrates core AI principles while remaining balanced and fair for human players. The configurable parameters allow for fine-tuning difficulty, and the architecture supports future enhancements without requiring major rewrites.</content>
<parameter name="filePath">/home/rlane/Rufus_Projects/Transcendencex/frontend/docs/ai design.md
