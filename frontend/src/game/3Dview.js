(function () {
    const canvas = document.getElementById('renderCanvas');
    // Enable alpha in the WebGL context so the canvas can be transparent
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, alpha: true });
    const scene = new BABYLON.Scene(engine);
    // Make the scene clear color fully transparent (r,g,b,alpha)
    if (BABYLON.Color4) {
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    }

    // Camera and light
    // Configurable defaults
    let DEFAULT_CAMERA_RADIUS = 18; // units from camera to target, editable at runtime
    let DEFAULT_CAMERA_BETA = Math.PI / 3; // vertical angle
    let DEFAULT_CAMERA_TARGET_Y = -3; // vertical offset applied to computed target

    window.setDefaultCameraRadius = (v) => { DEFAULT_CAMERA_RADIUS = Number(v); console.log('DEFAULT_CAMERA_RADIUS ->', DEFAULT_CAMERA_RADIUS); };
    window.setDefaultCameraBeta = (v) => { DEFAULT_CAMERA_BETA = Number(v); console.log('DEFAULT_CAMERA_BETA ->', DEFAULT_CAMERA_BETA); };
    window.setDefaultCameraTargetY = (v) => { DEFAULT_CAMERA_TARGET_Y = Number(v); console.log('DEFAULT_CAMERA_TARGET_Y ->', DEFAULT_CAMERA_TARGET_Y); };

    const camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 2, DEFAULT_CAMERA_BETA, DEFAULT_CAMERA_RADIUS, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 50;
    // Disable camera keyboard controls so arrow keys can be used for gameplay input
    // Clearing these arrays prevents the camera from responding to arrow keys.
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    // --- Configurable variables (centralized) ---
    // Symmetric paddle movement range (center = 0). Default: 4.25
    window.PADDLE_RANGE = (typeof window.PADDLE_RANGE === 'number') ? window.PADDLE_RANGE : 4.25;
    window.setPaddleRange = function (v) { window.PADDLE_RANGE = Number(v); console.log('PADDLE_RANGE ->', window.PADDLE_RANGE); };

    // Paddle movement speed (units per second). Mutable via setter.
    let PADDLE_SPEED = (typeof window.PADDLE_SPEED === 'number') ? window.PADDLE_SPEED : 6;
    window.setPaddleSpeed = function (v) { PADDLE_SPEED = Number(v); console.log('PADDLE_SPEED ->', PADDLE_SPEED); };

    // Debug logging settings for paddles
    window.debugPaddleLogging = window.debugPaddleLogging === undefined ? true : window.debugPaddleLogging;
    const PADDLE_LOG_INTERVAL = 250; // ms
    let _lastPaddleLog = 0;
    // Expose PADDLE_SPEED to the rest of the script scope via a closure variable

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.9;

    const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dir.intensity = 0.7;

    // Load the GLB model named pong.glb in the same folder
    const modelUrl = 'pong.glb';

    function computeSceneBoundingInfo(meshes) {
        if (!meshes || meshes.length === 0) return null;
        let min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        let max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        meshes.forEach(mesh => {
            if (!mesh.getBoundingInfo) return;
            const boundingInfo = mesh.getBoundingInfo();
            const bMin = boundingInfo.boundingBox.minimumWorld;
            const bMax = boundingInfo.boundingBox.maximumWorld;
            min = BABYLON.Vector3.Minimize(min, bMin);
            max = BABYLON.Vector3.Maximize(max, bMax);
        });

        return { min, max };
    }

    BABYLON.SceneLoader.Append('', modelUrl, scene, function (scene) {
        // When loaded, compute bounds and position camera
        const loadedMeshes = scene.meshes.filter(m => m && m.getTotalVertices && m.getTotalVertices() > 0);
        const bounds = computeSceneBoundingInfo(loadedMeshes.length ? loadedMeshes : scene.meshes);
        if (bounds) {
            const size = bounds.max.subtract(bounds.min);
            const center = bounds.min.add(size.scale(0.5));
            // move camera target to center (apply optional vertical offset)
            const targetWithY = center.clone();
            targetWithY.y += DEFAULT_CAMERA_TARGET_Y;
            camera.setTarget(targetWithY);

            // fit camera radius to the bounding sphere for a nice view
            const radius = Math.max(size.length() * 0.6, 1.5);
            // Force a visibly farther view: respect DEFAULT_CAMERA_RADIUS and apply multiplier
            const chosen = Math.max(radius, DEFAULT_CAMERA_RADIUS);
            camera.radius = chosen;
            console.log('computed radius', radius, 'chosen camera.radius', chosen, 'camera.target', camera.target);
        }

        // make sure shadows/lighting update
        scene.render();
    }, null, function (scene, message) {
        console.error('Error loading model:', message);
    });

    // Paddle controls
    let paddle1 = null;
    let paddle2 = null;
    let boundsXMin = null;
    let boundsXMax = null;


    // Authoritative paddle positions (can be driven by server or other scripts)
    window.gameState = window.gameState || { paddle1_x: undefined, paddle2_x: undefined };

    // Key state flags
    const keyState = {
        p1Left: false,
        p1Right: false,
        p2Left: false,
        p2Right: false
    };

    // Movement speed is defined in the centralized config above (PADDLE_SPEED)

    // Helper: try to find paddles by name heuristics after model load
    function findPaddlesFromScene(s) {
        const meshes = s.meshes || [];
        // case-insensitive name search for 'paddle'
        const paddleMeshes = meshes.filter(m => m && m.name && /paddle/i.test(m.name));
        if (paddleMeshes.length >= 2) {
            paddle1 = paddleMeshes[0];
            paddle2 = paddleMeshes[1];
        } else if (paddleMeshes.length === 1) {
            paddle1 = paddleMeshes[0];
            // try to pick another common name
            paddle2 = meshes.find(m => m && m.name && /paddle2|player2|p2/i.test(m.name)) || null;
        } else {
            // fallback: look for common names
            paddle1 = meshes.find(m => m && m.name && /paddle1|player1|p1/i.test(m.name)) || null;
            paddle2 = meshes.find(m => m && m.name && /paddle2|player2|p2/i.test(m.name)) || null;
        }

        if (!paddle1 || !paddle2) {
            console.warn('Could not find two paddle meshes by name. Found:', paddle1 && paddle1.name, paddle2 && paddle2.name);
        } else {
            console.log('Paddles found:', paddle1.name, paddle2.name);
            // initialize authoritative positions if not set
            if (window.gameState.paddle1_x === undefined || window.gameState.paddle1_x === null) window.gameState.paddle1_x = paddle1.position.x;
            if (window.gameState.paddle2_x === undefined || window.gameState.paddle2_x === null) window.gameState.paddle2_x = paddle2.position.x;
            // clamp initial positions to configured symmetric range
            if (typeof window.PADDLE_RANGE === 'number') {
                const r = window.PADDLE_RANGE;
                window.gameState.paddle1_x = Math.max(-r, Math.min(r, window.gameState.paddle1_x));
                window.gameState.paddle2_x = Math.max(-r, Math.min(r, window.gameState.paddle2_x));
            }
            // Hide duplicate/static paddle meshes that are colocated with our chosen paddles
            try {
                const allPaddles = meshes.filter(m => m && m.name && /paddle/i.test(m.name));
                const hidden = [];
                const EPS = 0.1; // meters
                allPaddles.forEach(m => {
                    if (!m || m === paddle1 || m === paddle2) return;
                    if (!m.position) return;
                    // compare distance to paddle1 and paddle2
                    const d1 = paddle1 && paddle1.position ? BABYLON.Vector3.Distance(m.position, paddle1.position) : Number.POSITIVE_INFINITY;
                    const d2 = paddle2 && paddle2.position ? BABYLON.Vector3.Distance(m.position, paddle2.position) : Number.POSITIVE_INFINITY;
                    if (d1 < EPS || d2 < EPS) {
                        m.isVisible = false;
                        try { m.setEnabled && m.setEnabled(false); } catch (e) {}
                        hidden.push(m.name || '<unnamed>');
                    }
                });
                if (hidden.length) console.log('Hidden duplicate paddle meshes:', hidden);
            } catch (err) {
                console.warn('Error while hiding duplicate paddles:', err);
            }
        }
    }

    // Render loop with paddle movement update
    engine.runRenderLoop(function () {
        const dt = engine.getDeltaTime() / 1000; // seconds

        // compute bounds from scene if available
        if (boundsXMin === null || boundsXMax === null) {
            try {
                const allMeshes = scene.meshes;
                const info = (function (meshes) {
                    if (!meshes || meshes.length === 0) return null;
                    let min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
                    let max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
                    meshes.forEach(mesh => {
                        if (!mesh.getBoundingInfo) return;
                        const bi = mesh.getBoundingInfo();
                        min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
                        max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
                    });
                    return { min, max };
                })(allMeshes);

                if (info) {
                    boundsXMin = info.min.x;
                    boundsXMax = info.max.x;
                }
            } catch (e) {
                // ignore
            }
        }

        // Update paddle1 driven by authoritative gameState
        if (paddle1) {
            // keyboard affects authoritative variable
            const dir = (keyState.p1Right ? 1 : 0) - (keyState.p1Left ? 1 : 0);
            if (dir !== 0) {
                window.gameState.paddle1_x = (window.gameState.paddle1_x || 0) + dir * PADDLE_SPEED * dt;
            }
            // clamp to symmetric paddle range centered at 0
            if (typeof window.PADDLE_RANGE === 'number') {
                const r = window.PADDLE_RANGE;
                window.gameState.paddle1_x = Math.max(-r, Math.min(r, window.gameState.paddle1_x));
            }
            if (typeof window.gameState.paddle1_x === 'number') paddle1.position.x = window.gameState.paddle1_x;
        }

        // Update paddle2 driven by authoritative gameState
        if (paddle2) {
            const dir = (keyState.p2Right ? 1 : 0) - (keyState.p2Left ? 1 : 0);
            if (dir !== 0) {
                window.gameState.paddle2_x = (window.gameState.paddle2_x || 0) + dir * PADDLE_SPEED * dt;
            }
            // clamp to symmetric paddle range centered at 0
            if (typeof window.PADDLE_RANGE === 'number') {
                const r = window.PADDLE_RANGE;
                window.gameState.paddle2_x = Math.max(-r, Math.min(r, window.gameState.paddle2_x));
            }
            if (typeof window.gameState.paddle2_x === 'number') paddle2.position.x = window.gameState.paddle2_x;
        }

    scene.render();
    try { maybeLogPaddles(performance.now()); } catch (e) { /* ignore in older browsers */ }
    });

    // Periodic paddle logging
    function maybeLogPaddles(now) {
        if (!window.debugPaddleLogging) return;
        if (now - _lastPaddleLog < PADDLE_LOG_INTERVAL) return;
        _lastPaddleLog = now;
        console.log('paddle1_x=', window.gameState.paddle1_x, 'paddle2_x=', window.gameState.paddle2_x);
    }

    window.togglePaddleLogging = function (enabled) {
        if (typeof enabled === 'boolean') window.debugPaddleLogging = enabled;
        else window.debugPaddleLogging = !window.debugPaddleLogging;
        console.log('debugPaddleLogging ->', window.debugPaddleLogging);
    };

    // Keyboard handlers
    window.addEventListener('keydown', function (e) {
        const k = e.key;
        // paddle1: a,w -> left ; d,s -> right
        if (k === 'a' || k === 'A' || k === 'w' || k === 'W') keyState.p1Left = true;
        if (k === 'd' || k === 'D' || k === 's' || k === 'S') keyState.p1Right = true;

        // paddle2: ArrowLeft/ArrowUp -> left ; ArrowRight/ArrowDown -> right
        if (k === 'ArrowLeft' || k === 'ArrowUp') keyState.p2Left = true;
        if (k === 'ArrowRight' || k === 'ArrowDown') keyState.p2Right = true;
    });

    window.addEventListener('keyup', function (e) {
        const k = e.key;
        if (k === 'a' || k === 'A' || k === 'w' || k === 'W') keyState.p1Left = false;
        if (k === 'd' || k === 'D' || k === 's' || k === 'S') keyState.p1Right = false;

        if (k === 'ArrowLeft' || k === 'ArrowUp') keyState.p2Left = false;
        if (k === 'ArrowRight' || k === 'ArrowDown') keyState.p2Right = false;
    });

    // When the model loads, attempt to find paddles
    BABYLON.SceneLoader.Append('', modelUrl, scene, function (s) {
        // This Append callback already exists earlier; keep compatibility by running paddle detection here too.
        try {
            findPaddlesFromScene(s);
            // expose for debugging
            window.paddle1 = paddle1;
            window.paddle2 = paddle2;
        } catch (err) {
            console.warn('Paddle detection failed:', err);
        }
    }, null, function (scene, message) {
        console.error('Error loading model:', message);
    });

    // Helper to reset authoritative paddle positions and apply immediately
    window.resetPaddles = function (p1x = undefined, p2x = undefined) {
        if (typeof p1x === 'number') window.gameState.paddle1_x = p1x;
        if (typeof p2x === 'number') window.gameState.paddle2_x = p2x;
        if (paddle1 && typeof window.gameState.paddle1_x === 'number') paddle1.position.x = window.gameState.paddle1_x;
        if (paddle2 && typeof window.gameState.paddle2_x === 'number') paddle2.position.x = window.gameState.paddle2_x;
    };

    // Resize handler
    window.addEventListener('resize', function () {
        engine.resize();
    });

    // Double click to toggle fullscreen for the canvas
    canvas.addEventListener('dblclick', function () {
        if (!document.fullscreenElement) {
            canvas.requestFullscreen().catch(err => console.warn('Fullscreen failed:', err));
        } else {
            document.exitFullscreen();
        }
    });
})();
