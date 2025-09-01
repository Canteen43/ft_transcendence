# Gamestate Communications Design

## Purpose

This document defines the high-level design and protocol for gamestate communications for the Pong3D project. It describes the roles, message flows, data models, synchronization strategy, and testing/validation considerations for an architecture where Player 1's local `Pong3D` instance acts as the authoritative game server ("master") and all other players run client-mode `Pong3D` instances. A lightweight relay server forwards WebSocket messages between participants.

This is a design-only draft. No implementation code is included here. We'll iterate on the details and then convert agreed sections into implementation tasks.

---

## Checklist (requirements extracted)
- The Player 1 instance of `Pong3D` will be the authoritative gamestate (master/server).
- Other players run `Pong3D` in client mode.
- Clients update their own paddle position directly from input (local immediate response).
- Each player maintains a WebSocket to a relay server that forwards messages to all participants.
- Clients receive all positioning coordinates via WebSocket, except for their own paddle which they update locally.
- Clients relay their own paddle position updates to the master (via the relay server).

---

## Actors and Roles

- Master (Authoritative Server)
  - The Player 1 local `Pong3D` instance.
  - Maintains the authoritative game state: ball position/velocity/spin, paddles state, scores, goals, and tick counter.
  - Receives paddle updates from clients and applies them (after validation) to the authoritative state.
  - Advances the physics/tick and broadcasts periodic authoritative snapshots to all clients via the relay server.

- Clients
  - Local `Pong3D` instances running in client mode (players 2..N).
  - Immediately update their local paddle in response to input (low-latency local feel).
  - Continuously send paddle updates to the relay server for forwarding to the master.
  - Receive authoritative snapshots and remote paddle updates from the master (via relay) and render other players and ball accordingly.
  - Ignore authoritative updates for their own paddle for immediate responsiveness, but still use master snapshots for reconciliation.

- Relay Server
  - Simple WebSocket relay (stateless or near-stateless) whose primary job is to forward messages between participants.
  - Does not perform game logic or validation (keeps trust model centralized to master). Optionally performs light checks, authentication, or rate limiting.

---

## Network Topology

- Every participant (master + clients) maintains a single persistent WebSocket connection to the Relay Server.
- Message routing pattern:
  - Client -> Relay -> Master (paddle updates)
  - Master -> Relay -> All Clients (authoritative snapshots and state events)
  - Relay can mirror client messages to all participants if desired (but authoritative state always comes from master)

This setup preserves a single authoritative replica while keeping the relay server simple.

---

## Message Types (logical descriptions)

1. Client -> Relay -> Master: PaddleUpdate
   - Purpose: inform master of client's desired paddle state (position/velocity) and input sequence information.
   - Fields (conceptual): playerId, localSeq, tickHint (optional), position (x or z depending on mode), velocity, timestamp (client clock), inputState (optional), reliability hints.
   - Notes: send at a frequent but rate-limited cadence (e.g., 15–30Hz). Include a monotonically incrementing `localSeq` to enable reconciliation.

2. Master -> Relay -> Clients: GameStateSnapshot
   - Purpose: authoritative world state for rendering and reconciliation.
   - Fields (conceptual): tick (authoritative tick counter), ball: {pos, vel, spin}, paddles: [{playerId, pos, vel, lastInputSeq}], scores, events (goals, resets), serverTimestamp.
   - Notes: snapshots can be delta-compressed or full. Send at a fixed tick rate (e.g., 20Hz) or at a multiple of the physics tick.

3. Optional Relay/Peer Messages
   - Join/Leave, Ping/Pong, version/feature negotiation, and control messages (pause, resume).

---

## Data Model (high-level)

- Paddle state (per player)
  - playerId (1..N)
  - pos (float) — movement axis dependent (X or Z axis as per game mode)
  - vel (float)
  - lastInputSeq (int) — last client-sent sequence number applied by master
  - authoritativeFlag (bool) — master-owned/validated flag (not required in message if implicit)

- Ball state
  - pos: {x,z}
  - vel: {x,z}
  - spin: scalar or vector (depending on implementation)

- Game snapshot envelope
  - tick (int) — authoritative tick number
  - serverTimestamp (ms) — for optional smoothing calculations
  - paddles[]
  - ball
  - scores
  - events[] — goal triggers, resets, special events

---

## Synchronization Strategy

1. Authority model
   - Master is authoritative for the entire world. Clients are authoritative for their own local input only until the master validates and includes them in a snapshot.
   - Clients update their own paddle locally for immediate responsiveness (client-side prediction). They still send regular PaddleUpdate messages to the master.

2. Reconciliation
   - Master applies incoming paddle updates in order (sequence numbers) and clamps/validates positions (respecting PADDLE_RANGE, max velocity, etc.).
   - Master includes `lastInputSeq` for each player's paddle in snapshots so clients can reconcile.
   - When a client receives a snapshot containing a different authoritative position for its own paddle (beyond a small tolerance), the client should smoothly correct (reconcile) the local paddle: either snap if difference is large or do a short correction interpolation to avoid visible jitter.

3. Remote objects (ball & other paddles)
   - Clients render remote paddles and the ball using interpolation based on recent authoritative snapshots (ex: keep 100–200ms render buffer and interpolate between known snapshot states).
   - Extrapolation may be used when latency spikes, but capped and decayed quickly.

---

## Timing, Rates, and Bandwidth

- Recommended authoritative tick / snapshot rate: 15–30Hz. Balance between bandwidth and responsiveness. For Pong, 20Hz is a reasonable starting point.
- Paddle updates from clients: 15–60Hz depending on input frequency and available bandwidth; can be compressed by sending only changed values and using dead-reckoning.
- Typical message sizes should be small (a few dozen bytes per update) — use JSON or lightweight binary format (CBOR/Protobuf) depending on final performance needs.

---

## Latency Compensation and Prediction

- Client-side prediction for own paddle: clients apply local input immediately then send updates to master.
- Server reconciliation: master includes `lastInputSeq` in snapshots; the client can discard applied local inputs up to that sequence and reapply any remaining inputs if using input-buffering. For a simple position-only system, reconciliation can be position-based using `lastInputSeq` as a hint.
- Ball handling: since master is authoritative for physics, clients only interpolate/extrapolate ball positions between snapshots.

---

## Ordering, Reliability, and Consistency

- WebSockets use TCP, so messages are delivered in order per connection. However, messages from different clients arrive independently, and end-to-end ordering across peers is not guaranteed.
- Use monotonic sequence numbers / ticks in messages so receivers can detect duplicates, out-of-order messages, and missing updates.
- For critical events (goals, resets), master publishes an event in the authoritative snapshot and may also emit an immediate "event" message to reduce perceived latency for those events.

---

## Validation and Anti-Cheating

- Master must validate client-provided paddle updates to defend against invalid positions or impossible velocities:
  - Clamp positions to allowed range (PADDLE_RANGE).
  - Clamp velocities to PADDLE_MAX_VELOCITY.
  - Rate-limit updates per client.
- Relay server should perform authentication/authorization checks and optionally rate-limit abusive clients.

---

## Failover and Edge Cases

- Master disconnects
  - Primary design assumes Player 1 is master. If master disconnects mid-game, define a strategy:
    - Pause game and attempt to reconnect master, or
    - Elect a new master (e.g., next player index) and perform state transfer (requires snapshot handoff), or
    - Force restart of match. 
  - Handoff/election increases complexity; implement only if uninterrupted play across master failures is required.

- Late joins / reconnections
  - Relay/master should support an explicit `JoinRequest` event; master responds with a full `GameStateSnapshot` to bring new client up to date.
  - On reconnection, clients should resynchronize using latest authoritative snapshot before resuming play.

---

## Security and Privacy

- Use secure WebSocket (wss://) in production.
- Authenticate players at connect time; attach an opaque playerId to the socket connection and do not trust client-supplied playerId fields.
- Relay server should not accept messages from clients that are not authenticated or that claim other players' IDs.

---

## Testing Plan

1. Unit tests for message serialization/deserialization and validation logic.
2. A local integration harness that runs multiple `Pong3D` instances (master + N clients) connected through a mock relay and exercises network conditions (latency, jitter, packet reordering by delaying, although WebSocket/TCP reduces reordering chance).
3. Scripted replay tests that simulate client input sequences and assert the master's snapshots remain deterministic and within tolerances.
4. Visual/manual testing: run clients with instrumentation to log `PaddleUpdate` messages and master snapshots, verify reconciliation behavior when artificial lag is injected.

---

## Versioning and Backwards Compatibility

- Include a small `protocolVersion` field in top-level messages so future changes to message shape can be negotiated.
- When changing semantics (e.g., unit changes, different tick rates), support version negotiation or an upgrade window.

---

## Next Steps (suggested)

1. Review this design and confirm assumptions (master is Player 1, relay is a simple forwarder).
2. Decide on concrete message serialization format (JSON vs binary) and exact field names.
3. Choose authoritative tick rate and client update cadence.
4. Add a minimal message schema appendix with exact fields and types (will become the protocol spec).
5. Implement a small relay proof-of-concept and a test harness to validate timing and reconciliation.

---

If this looks good, I can:
- produce a compact message-schema appendix (no code, only field names and types), or
- add a sequence diagram for the typical flows (Client -> Relay -> Master -> Relay -> Clients), or
- start implementing tests/harness code once you approve the protocol details.

Which of these would you like to do next?
