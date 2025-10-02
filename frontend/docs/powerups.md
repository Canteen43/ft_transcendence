Power Ups Outline
=================

- Power ups appear as slow-moving discs with clear icons so players can quickly identify their effect.
- They drift across the arena using the same physics pathing as the ball but at a reduced speed to give players time to react.
- A power up activates immediately when a player paddle collides with it; the disc vanishes after activation.
- Effects persist until their stated expiration condition is met and then revert to normal gameplay values.

Spawn + Movement Rules
----------------------
- Spawn cadence runs on a timer that picks a value between configurable `powerup_spawn_min_s` and `powerup_spawn_max_s`; tweak during playtesting.
- Discs instantiate at arena origin (`x = 0, z = 0`) before drifting.
- Drift direction uses a random normalized vector; speed is controlled by a `powerup_drift_speed` variable so designers can balance pacing.

Integration Plan
----------------
- Implement power-up behaviors in a dedicated `Pong3Dpowerups.ts` module that encapsulates spawn logic and effect application.
- Track activation flags inside session data using keys `split`, `boost`, `stretch`, and `shrink`; mark active power ups with string value "1" (can revisit to booleans later if needed).
- Main `Pong3D` flow should inspect these session data flags in local-only mode, applying the corresponding effects when present.
- Export helper functions from `Pong3Dpowerups.ts` for the main loop to call each frame; a `spawnPowerup()` helper should roll a random integer between 1 and 4 (or the count of enabled session flags) to select which effect to instantiate.

Visual + Technical Notes
------------------------
- Create the disc mesh in Blender; use flat, high-contrast iconography for readability at a distance.
- Consider subtle particle trails or glow to make power ups stand out against the playfield.
- Spawn logic should avoid placing discs too close to paddles to keep the interaction intentional.
- Import each disc GLB with the same coordinate scaling as the court asset so Babylon's existing lights hit them correctly; no special setup needed beyond attaching them to the main scene node unless we switch to baked lighting.
- Optional: pack all disc variants into a single GLB, keep them co-located, and toggle mesh visibility when instantiating; they can all share the same physics impostor template if scale/shape match.
- Current plan: store them in `powerups.glb` with mesh names `powerup.split`, `powerup.boost`, `powerup.stretch`, and `powerup.shrink` so the loader can grab each variant deterministically.

Power Up Concepts
-----------------
1. Split Ball
   - On pickup, spawn a second ball mirroring the current ball's position and velocity, with a + or - 90 degree offset velocity.
   - Both balls stay active until one exits play; then the remaining ball continues as the primary.

2. Overdrive
   - Temporarily raises the active ball's maximum speed to 2x the current cap.
   - Duration ends when the powered ball leaves play (goal or out-of-bounds).

3. Paddle Stretch
   - Increases the collecting player's paddle width for extra coverage.
   - Effect lasts until the next goal is scored by either side.

4. Paddle Shrink
   - Reduces the opposing player's paddle width, making defense harder.
   - Ends as soon as any goal is scored.

Open Questions
-------------
- Should power ups spawn on a timer, from specific triggers, or randomly after rallies?
- Do multiple power ups stack, and how are conflicting effects resolved?
- How many power ups can be active simultaneously without overwhelming players?
