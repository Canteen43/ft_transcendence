# Pong3D Multiplayer Game Design Document

## Overview

Pong3D is a distributed multiplayer 3D Pong game supporting 2-4 players. The architecture uses a client-server### 4. Communication Protocolmodel with one authoritative physics i### 5. Network Archit### 6. State Managementcturestance an### 7. Lag Compensation Strategies multiple rendering clients connected via WebSocket.

## Architecture Principles

### Client-Server Model
- **Authoritative Server**: Player 1 runs the physics simulation and game logic
- **Backend Relay Server**: Dedicated server backend that relays gamestate information using the Pong Protocol
- **Rendering Clients**: Players 2-4 receive game state and render locally
- **Real-time Communication**: WebSocket-based JSON message protocol via backend server
- **Distributed Input**: Each player controls their own paddle directly
- **Pong Protocol**: Custom JSON-based communication protocol (documented separately)

## Core Components

### 1. Coordinate System & Movement Constraints

#### Babylon.js Coordinate System
- **X-Axis**: Horizontal (left/right)
- **Y-Axis**: Vertical (up/down) - **Fixed for gameplay**
- **Z-Axis**: Horizontal (forward/backward)

#### Game Physics Plane
- **Ball Movement**: Constrained to X-Z plane (horizontal movement only)
- **Paddle Movement**: 3D coordinate system with displacement from GLB-defined positions
- **Y-Coordinate**: Fixed at court level (Y = 0) for all game objects during play
- **3D Visualization**: Y-axis used for camera positioning and visual effects only

#### Player Positioning & Movement

Player positions and court geometry are defined by the imported GLB files:
- **2-Player Mode**: Loads `pong2p.glb` with rectangular court
- **3-Player Mode**: Loads `pong3p.glb` with triangular court  
- **4-Player Mode**: Loads `pong4p.glb` with rectangular court

**Movement Implementation:**
- **2-Player & Players 1-2 in 4-Player**: Movement along X-axis from GLB position
- **Players 3-4 in 4-Player Mode**: Movement along Z-axis from GLB position
- **3-Player Triangular Mode**: Projected movement along angled edges using rotation matrices

**3-Player Movement Math:**
```typescript
// Player angles: 0°, 240°, 120° for triangular edges
const angles = [0, 4 * Math.PI / 3, 2 * Math.PI / 3];
// Project input to logical axis, then convert back to X-Z displacement
const deltaX = logicalPosition * Math.cos(angle);
const deltaY = logicalPosition * Math.sin(angle);
```

### 2. Physics & Collision Detection System

#### Collision Detection Approach

**Babylon.js Mesh-Based Collision Detection:**
- **Ball as Sphere**: Sphere collision detection for performance and accuracy
- **Paddles as Meshes**: Use actual GLB mesh geometry (paddle1, paddle2, paddle3, paddle4)
- **Boundaries as Meshes**: Use GLB mesh geometry (boundary1, boundary2, boundary3, boundary4)
- **Hybrid System**: Sphere-to-mesh collision detection without external physics library

#### Two-Phase Detection Strategy

**Broad Phase:**
- Quick distance/bounding box checks using `mesh.getBoundingInfo()`
- Filter potential collisions before expensive mesh intersection tests
- Use `BABYLON.Vector3.Distance()` for initial proximity detection

**Narrow Phase:**
- Precise collision detection using `scene.pickWithRay()` with ray casting
- Automatic normal extraction using `hit.getNormal(true)` for world space normals
- Extract exact collision point with `hit.pickedPoint`
- Built-in mesh transformation handling (rotation, scaling)

#### Collision Response Physics

**Reflection Formula:**
```
Reflected Vector = Incident Vector - 2 × (Incident · Normal) × Normal
```

**Implementation Steps:**
1. **Cast Ray**: From previous ball position toward current position using `BABYLON.Ray`
2. **Detect Collision**: Use `scene.pickWithRay()` against paddle/boundary meshes
3. **Extract Data**: Get collision point (`hit.pickedPoint`) and surface normal (`hit.getNormal(true)`)
4. **Calculate Reflection**: Apply physics formula with extracted normal
5. **Add Paddle Influence**: Modify reflection based on paddle velocity (optional)
6. **Position Correction**: Move ball to exact collision point to prevent tunneling

#### Surface Normal Extraction

**Ray Casting Method (Recommended):**
```typescript
const ray = new BABYLON.Ray(ballPrevPos, ballDirection);
const hit = scene.pickWithRay(ray, mesh => mesh === paddleMesh);

if (hit.hit) {
    const collisionPoint = hit.pickedPoint;
    const normal = hit.getNormal(true); // true = world space
    // Use normal for reflection calculation
}
```

**Mesh Data Method (Alternative):**
```typescript
// Extract face normals from mesh geometry
const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
const indices = mesh.getIndices();
// Find closest face normal to collision point
// Transform normal by mesh rotation and scaling
```

**Babylon.js Built-in Capabilities:**
- `hit.getNormal(true)` returns surface normal at ray intersection point
- Automatic handling of mesh transformations (rotation, scaling)
- World space normal calculation for physics accuracy
- **Paddle Collision**: Reflection + paddle velocity influence + potential spin
- **Boundary Collision**: Pure reflection or goal detection
- **Corner Collision**: Handle multiple simultaneous surface interactions

#### Tunneling Prevention

**High-Speed Ball Problem:**
- Ball moves too fast between frames, passes through paddle
- **Solution**: Ray casting between previous and current ball position
- Use `scene.pickWithRay()` to detect intermediate collisions

#### Physics Parameters

**Ball Properties:**
- Velocity magnitude and direction
- Bounciness (energy retention coefficient)
- Maximum speed limits for gameplay balance

**Paddle Interaction:**
- Paddle velocity influence on ball direction
- Sweet spot mechanics for skilled play
- English/spin effects (advanced feature)

**Boundary Behavior:**
- Energy conservation vs. damping
- Goal zone detection
- Corner bounce handling

#### Development Phases

**Phase 1: Basic Collision System**
- Ball-paddle mesh intersection detection
- Simple reflection using extracted normals
- Boundary collision and goal detection

**Phase 2: Enhanced Physics**
- Paddle velocity influence on ball
- Improved corner and edge case handling
- Performance optimization with spatial partitioning

**Phase 3: Advanced Features**
- Spin mechanics and ball physics
- Variable bounce characteristics
- Optional CannonJS integration for complex scenarios

### 3. Game Instance Types

#### Authoritative Instance (Player 1)
- **Role**: Physics simulation, collision detection, game logic
- **Responsibilities**:
  - Ball physics and trajectory calculation
  - Mesh-based collision detection (ball vs. paddles/boundaries)
  - Collision response and reflection calculations
  - Score tracking and game state management
  - Game rule enforcement (boundaries, scoring conditions)
  - Broadcasting game state to backend server via Pong Protocol
- **Input**: Receives paddle positions from all players via backend server
- **Output**: Broadcasts complete game state to backend server for relay to all clients

#### Rendering Instance (Players 2-4)
- **Role**: Visual rendering and local input handling
- **Responsibilities**:
  - Rendering 3D scene with received game state
  - Local paddle input processing and smoothing
  - Camera POV management for player perspective
  - UI rendering (scores, player info)
  - Transmitting local paddle position to backend server via Pong Protocol
- **Input**: Receives game state from backend server relaying from authoritative instance
- **Output**: Sends paddle position updates to backend server for relay to authoritative instance

### 2. Communication Protocol

#### Backend Server (Relay)
The backend server acts as a central relay hub, implementing the **Pong Protocol** for all game communication. It does not run game logic but efficiently routes messages between the authoritative instance and rendering clients.

**Key Functions**:
- Message routing and broadcasting
- Player session management
- Connection state monitoring
- Protocol validation and error handling

> **Note**: The complete Pong Protocol specification is documented in `PONG_PROTOCOL.md`

#### WebSocket Message Types

##### Server → All Clients (Game State Broadcast)
```json
{
  "type": "game_state",
  "timestamp": 1672531200000,
  "ball": {
    "position": {"x": 0, "y": 0, "z": 0},
    "velocity": {"x": 5.2, "y": 0, "z": 3.1}
  },
  "paddles": [
    {"playerId": 1, "positionX": -1.2, "positionY": 0.8, "active": true},
    {"playerId": 2, "positionX": 2.1, "positionY": -0.5, "active": true},
    {"playerId": 3, "positionX": 0.3, "positionY": 1.8, "active": true},
    {"playerId": 4, "positionX": 0, "positionY": 0, "active": false}
  ],
  "scores": [2, 1, 0, 0],
  "gameStatus": "playing"
}
```

> **Note**: Paddle positions represent displacement from original GLB positions. `positionX` and `positionY` are offset values added to the paddle's GLB-defined base position.

##### Client → Server (Paddle Update)
```json
{
  "type": "paddle_update",
  "playerId": 2,
  "timestamp": 1672531200000,
  "positionX": 2.1,
  "positionY": -0.5,
  "inputState": {
    "left": false,
    "right": true
  }
}
```

> **Note**: Paddle positions represent displacement from GLB-defined base positions. The movement system handles coordinate transformation automatically based on player configuration and court geometry.

##### Server → All Clients (Game Events)
```json
{
  "type": "game_event",
  "event": "goal_scored",
  "data": {
    "scoringPlayer": 1,
    "newScores": [3, 1, 0, 0],
    "ballReset": true
  }
}
```

### 3. Network Architecture

#### Message Flow
```
Player 1 (Authoritative)    Backend Server (Relay)    Players 2-4 (Rendering)
     |                            |                         |
     |-- Physics Simulation ------|                         |
     |-- Game State (Pong ------>|-- Game State --------->|
     |   Protocol)                |   (Pong Protocol)      |
     |                            |                         |
     |<-- Paddle Updates ---------|<-- Paddle Updates -----|
     |    (Pong Protocol)         |    (Pong Protocol)     |
     |                            |                         |
     |<-- Session Management -----|-- Player Join/Leave -->|
```

#### Update Frequencies
- **Game State Broadcast**: 60 Hz (16.67ms intervals)
- **Paddle Updates**: 120 Hz (8.33ms intervals) for responsive input
- **Physics Simulation**: 60 Hz (locked to game state broadcast)

### 4. State Management

#### Authoritative State (Player 1)
```typescript
interface AuthoritativeGameState {
  ball: {
    position: Vector3; // X-Z movement, Y = 0
    velocity: Vector3; // X-Z velocity, Y = 0
    lastCollision: number;
  };
  paddles: PaddleState[]; // Displacement values from GLB positions
  scores: number[];
  gameMode: '2player' | '3player' | '4player';
  gameStatus: 'waiting' | 'playing' | 'paused' | 'finished';
  playerConnections: PlayerConnection[];
}

interface PaddleState {
  playerId: number;
  positionX: number; // Displacement from GLB X position
  positionY: number; // Displacement from GLB Y position (used as Z in 3D)
  active: boolean;
}
```
```

#### Client State (Players 2-4)
```typescript
interface ClientGameState {
  receivedState: GameState;
  localPaddle: LocalPaddleState;
  interpolationBuffer: GameState[];
  predictionState: PredictionState;
  renderState: RenderState;
}
```

### 5. Lag Compensation Strategies

#### Client-Side Prediction
- **Local Paddle Movement**: Immediate response to input
- **State Reconciliation**: Adjust when server state differs
- **Rollback on Conflict**: Revert invalid predictions

#### Server-Side Lag Compensation
- **Input Buffering**: Queue paddle updates with timestamps
- **Retroactive Collision**: Account for network delay in physics
- **Smooth Corrections**: Gradual adjustment for visual continuity

#### Interpolation & Extrapolation
```typescript
// Client-side ball position interpolation in X-Z plane
function interpolateBallPosition(currentState: GameState, previousState: GameState, alpha: number): Vector3 {
  return {
    x: lerp(previousState.ball.position.x, currentState.ball.position.x, alpha),
    y: 0, // Fixed at court level
    z: lerp(previousState.ball.position.z, currentState.ball.position.z, alpha)
  };
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **Backend Server Setup**
   - Node.js/Express server with Socket.IO
   - Room management for game sessions
   - Player connection handling
   - Pong Protocol implementation and validation

2. **WebSocket Relay Implementation**
   - Message routing between authoritative and rendering instances
   - JSON schema validation for Pong Protocol
   - Message queuing and ordering
   - Error handling and reconnection

3. **Basic State Synchronization**
   - Game state relay via Pong Protocol
   - Paddle position updates routing
   - Connection management through backend

### Phase 2: Physics Authority
1. **Authoritative Physics Engine**
   - Move physics simulation to Player 1 instance
   - Ball-paddle collision detection
   - Boundary and goal detection

2. **State Validation**
   - Server-side paddle boundary checking (rectangular and triangular constraints)
   - Anti-cheat measures for movement validation
   - Input rate limiting

### Phase 3: Advanced Features
1. **Lag Compensation**
   - Client-side prediction
   - Server-side rollback
   - Smooth interpolation

2. **Reconnection Handling**
   - Save/restore game state
   - Spectator mode for disconnected players
   - Host migration (if Player 1 disconnects)

### Phase 4: Optimization
1. **Performance Tuning**
   - Message compression
   - Adaptive update rates
   - Network diagnostics

2. **Scalability Features**
   - Multiple concurrent games
   - Matchmaking system
   - Tournament mode

## Technical Considerations

### Network Performance
- **Bandwidth Usage**: ~1-2 KB/s per client for game state
- **Latency Requirements**: <100ms for responsive gameplay
- **Packet Loss Handling**: State buffering and retransmission

### Security Measures
- **Input Validation**: Server-side paddle position validation
- **Rate Limiting**: Prevent input flooding
- **State Verification**: Detect impossible movements

### Error Handling
- **Connection Loss**: Graceful degradation and reconnection
- **Desynchronization**: State recovery mechanisms  
- **Host Migration**: Transfer authority if Player 1 disconnects

### Platform Considerations
- **Browser Compatibility**: WebSocket support across browsers
- **Mobile Support**: Touch input handling for paddle control
- **Performance Scaling**: Adaptive quality based on device capabilities

## Player Experience

### Joining a Game
1. Player connects to game room
2. Receives current player count and available positions
3. Selects player position (1-4) or joins as spectator
4. Receives initial game state and camera POV configuration

### Gameplay Flow
1. **Player 1**: Starts as authoritative host, sees "HOST" indicator
2. **Players 2-4**: Join as rendering clients, see their POV
3. **Real-time Play**: All players see synchronized game state
4. **Score Events**: Immediate visual feedback with state confirmation

### Disconnection Handling
- **Player 1 Disconnect**: Game pauses, attempts host migration
- **Other Player Disconnect**: Game continues, paddle becomes AI-controlled
- **Reconnection**: Player rejoins with current game state

## Future Enhancements

### Advanced Features
- **Spectator Mode**: Additional viewers without player limit
- **Replay System**: Record and playback game sessions
- **Tournament Brackets**: Multi-game competition structure
- **Custom Game Modes**: Power-ups, variable physics, team play

### Technical Improvements
- **WebRTC Integration**: Peer-to-peer for reduced latency
- **Dedicated Servers**: Remove Player 1 authority requirement
- **Anti-Cheat System**: Advanced validation and monitoring
- **Analytics**: Performance metrics and gameplay statistics

---

## Implementation Notes

This design prioritizes:
- **Responsive Gameplay**: Immediate paddle control with network compensation
- **Scalable Architecture**: Clean separation of authority and rendering
- **Robust Networking**: Graceful handling of real-world network conditions
- **Flexible Player Count**: Support for 2-4 players with consistent experience

The modular architecture allows for incremental implementation and testing of each component independently.

## Related Documentation

- **Pong Protocol Specification**: `PONG_PROTOCOL.md` - Complete technical documentation of the JSON-based communication protocol used between all game instances and the backend server
- **API Reference**: Backend server endpoints and WebSocket event specifications  
- **Network Performance**: Detailed analysis of bandwidth usage and optimization strategies
