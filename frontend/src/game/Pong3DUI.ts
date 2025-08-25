// UI helper for Pong3D: builds GUI controls and returns references so the main scene can wire them
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export interface Pong3DUIOptions {
    playerNames?: string[]; // up to 4
    playerScores?: number[]; // up to 4
    positions?: ('top' | 'bottom' | 'left' | 'right')[]; // optional initial placement per player
}

export interface Pong3DUIHandles {
    guiTexture: GUI.AdvancedDynamicTexture;
    topContainer: GUI.Rectangle;
    bottomContainer: GUI.Rectangle;
    leftContainer: GUI.Rectangle;
    rightContainer: GUI.Rectangle;
    // per-player controls
    playerStacks: Array<GUI.StackPanel>;
    playerNameTexts: Array<GUI.TextBlock>;
    playerScoreTexts: Array<GUI.TextBlock>;
    movePlayerTo: (playerIndex: number, position: 'top' | 'bottom' | 'left' | 'right') => void;
    dispose: () => void;
}

export function createPong3DUI(scene: BABYLON.Scene, opts?: Pong3DUIOptions): Pong3DUIHandles {
    const names = opts?.playerNames ?? ['Player1', 'Player2', 'Player3', 'Player4'];
    const scores = opts?.playerScores ?? [0, 0, 0, 0];
    const positions = opts?.positions ?? ['bottom', 'top', 'right', 'left'];

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

    // create containers
    const topContainer = new GUI.Rectangle();
    topContainer.width = '380px';
    topContainer.height = '100px';
    topContainer.thickness = 0;
    topContainer.background = 'transparent';
    topContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    topContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    topContainer.top = -40;
    topContainer.left = 40; // nudge to the right
    guiTexture.addControl(topContainer);

    const bottomContainer = new GUI.Rectangle();
    bottomContainer.width = '380px';
    bottomContainer.height = '100px';
    bottomContainer.thickness = 0;
    bottomContainer.background = 'transparent';
    bottomContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    bottomContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    topContainer.top = -40;
    bottomContainer.left = 40; // nudge to the right
    guiTexture.addControl(bottomContainer);

    const leftContainer = new GUI.Rectangle();
    leftContainer.width = '280px';
    leftContainer.height = '400px';
    leftContainer.thickness = 0;
    leftContainer.background = 'transparent';
    leftContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    leftContainer.left = 10;
    leftContainer.top = '-15%'; // move up by 15% of canvas height
    guiTexture.addControl(leftContainer);

    const rightContainer = new GUI.Rectangle();
    rightContainer.width = '280px';
    rightContainer.height = '400px';
    rightContainer.thickness = 0;
    rightContainer.background = 'transparent';
    rightContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    rightContainer.left = -10;
    rightContainer.top = '-15%'; // move up by 15% of canvas height
    guiTexture.addControl(rightContainer);

    const playerStacks: Array<GUI.StackPanel> = [];
    const playerNameTexts: Array<GUI.TextBlock> = [];
    const playerScoreTexts: Array<GUI.TextBlock> = [];

    // helper to create a player block
    function makePlayerBlock(idx: number) {
        const stack = new GUI.StackPanel();
        // default to vertical; movePlayerTo will toggle for top/bottom
        stack.isVertical = true;

    // ensure stack can give room for large score when horizontal
    stack.height = '120px';
    stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

    const name = new GUI.TextBlock();
    // default: allow wrapping for side layout; movePlayerTo will tune for horizontal layout
    name.textWrapping = true;
    name.resizeToFit = true;
    name.width = '100%';
        name.text = names[idx] ?? `Player${idx + 1}`;
        // colors: p1 red, p2 blue, p3 green, p4 cyan
        const colors = ['red', 'blue', 'green', 'cyan'];
        name.color = colors[idx] ?? 'white';
        name.fontSize = 44;
        name.fontWeight = 'bold';
        name.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        name.paddingRight = '6px';

    const score = new GUI.TextBlock();
    // score should adapt but not claim full width in horizontal layout; width tuned in movePlayerTo
    score.textWrapping = false;
    score.resizeToFit = false;
    score.width = 'auto';
        score.text = String(scores[idx] ?? 0);
        score.color = 'white';
        score.fontSize = 50;
        score.fontWeight = 'bold';
    score.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    // vertically center text so when stacked horizontally both lines align
    score.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

    stack.addControl(name);
    stack.addControl(score);

    // default horizontal alignment
    stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.width = 'auto';

        playerStacks.push(stack);
        playerNameTexts.push(name);
        playerScoreTexts.push(score);
    }

    for (let i = 0; i < 4; i++) makePlayerBlock(i);

    // place stacks according to positions array
    const containerFor = (pos: 'top' | 'bottom' | 'left' | 'right') => {
        if (pos === 'top') return topContainer;
        if (pos === 'bottom') return bottomContainer;
        if (pos === 'left') return leftContainer;
        return rightContainer;
    };

    const currentParent: Array<GUI.Container | null> = [null, null, null, null];

    function movePlayerTo(playerIndex: number, position: 'top' | 'bottom' | 'left' | 'right') {
        if (playerIndex < 0 || playerIndex >= playerStacks.length) return;
        const stack = playerStacks[playerIndex];
        const target = containerFor(position);
        // remove from existing parent
        const prev = currentParent[playerIndex];
        try {
            if (prev && typeof (prev as any).removeControl === 'function') {
                (prev as any).removeControl(stack);
            }
        } catch (e) {}
        try {
            target.addControl(stack);
            currentParent[playerIndex] = target;
        } catch (e) {
            console.warn('Failed to move player stack', e);
        }
        // adjust orientation and alignment depending on container
        const isSide = position === 'left' || position === 'right';
        const name = playerNameTexts[playerIndex];
        const score = playerScoreTexts[playerIndex];
        // set vertical vs horizontal layout
        if (isSide) {
            // left/right: stack vertical, align text left/right
            stack.isVertical = true;
            stack.horizontalAlignment = position === 'left' ? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT : GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            // make stack fill the container so child controls with 100% width are visible
            stack.width = '100%';
            stack.left = 0;
            name.textHorizontalAlignment = position === 'left' ? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT : GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            score.textHorizontalAlignment = position === 'left' ? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT : GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            // padding and width: make name take container width so it wraps nicely, score centered below
            name.paddingRight = '6px';
            // Use explicit positioning instead of text alignment for scores
            if (position === 'left') {
                score.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                score.left = '0px'; // move 20px further left (was 10px, now -10px)
                score.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            } else {
                score.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
                score.left = '-10px'; // move 5px further right (was -10px, now -15px)
                score.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            }
            name.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
            score.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
            name.width = '100%';
            score.width = '100%'; // keep full width so alignment works properly
            // allow text to scale if needed
            name.resizeToFit = true;
            score.resizeToFit = true;
        } else {
            // top/bottom: stack horizontal, center both texts on one line
            stack.isVertical = false;
            stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            // align stack to top for top container, center for bottom
            stack.verticalAlignment = position === 'top' ? GUI.Control.VERTICAL_ALIGNMENT_TOP : GUI.Control.VERTICAL_ALIGNMENT_CENTER;
            // set fixed width to match content (name + score + padding)
            stack.width = '370px';
            stack.left = 0;
            // for horizontal layout, let text align naturally in their containers
            name.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            score.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            // align both to bottom so they sit on same baseline
            name.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            score.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            // give a little space between name and score when horizontal
            name.paddingRight = '12px';
            score.paddingLeft = '6px';
            // ensure stack height accommodates score
            stack.height = '100px';
            // tune widths so both name and score can sit side-by-side
            name.textWrapping = false;
            name.resizeToFit = false;
            name.width = '200px';
            score.width = '150px';
            score.resizeToFit = false;
        }
    }

    // initial placement
    for (let i = 0; i < 4; i++) {
        const pos = positions[i] ?? ['top', 'bottom', 'left', 'right'][i];
        movePlayerTo(i, pos);
    }

    return {
        guiTexture,
        topContainer,
        bottomContainer,
        leftContainer,
        rightContainer,
        playerStacks,
        playerNameTexts,
        playerScoreTexts,
        movePlayerTo,
        dispose: () => guiTexture.dispose(),
    };
}
