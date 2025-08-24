// UI helper for Pong3D: builds GUI controls and returns references so the main scene can wire them
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export interface Pong3DUIOptions {
    player1Name?: string;
    player2Name?: string;
    player1Score?: number;
    player2Score?: number;
}

export interface Pong3DUIHandles {
    guiTexture: GUI.AdvancedDynamicTexture;
    player1Container: GUI.Rectangle;
    Player1Info: GUI.TextBlock;
    score1Text: GUI.TextBlock;
    player2Container: GUI.Rectangle;
    Player2Info: GUI.TextBlock;
    score2Text: GUI.TextBlock;
    dispose: () => void;
}

export function createPong3DUI(scene: BABYLON.Scene, opts?: Pong3DUIOptions): Pong3DUIHandles {
    const player1Name = opts?.player1Name ?? 'Player1';
    const player2Name = opts?.player2Name ?? 'Player2';
    const player1Score = typeof opts?.player1Score === 'number' ? opts!.player1Score : 0;
    const player2Score = typeof opts?.player2Score === 'number' ? opts!.player2Score : 0;

    const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

    // Player 1 container (top-right)
    const player1Container = new GUI.Rectangle();
    player1Container.width = '400px';
    player1Container.height = '200px';
    player1Container.thickness = 0;
    player1Container.background = 'transparent';
    player1Container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    player1Container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    player1Container.top = 10;
    player1Container.left = -10;
    guiTexture.addControl(player1Container);

    const player1Stack = new GUI.StackPanel();
    player1Stack.isVertical = true;
    player1Stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    player1Stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

    const Player1Info = new GUI.TextBlock();
    Player1Info.textWrapping = true;
    Player1Info.resizeToFit = true;
    Player1Info.text = player1Name;
    Player1Info.color = 'red';
    Player1Info.fontSize = 48;
    Player1Info.fontFamily = 'Arial, Helvetica, sans-serif';
    Player1Info.fontWeight = 'bold';
    Player1Info.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    Player1Info.paddingRight = '6px';
    Player1Info.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    player1Stack.addControl(Player1Info);

    const score1Text = new GUI.TextBlock();
    score1Text.textWrapping = true;
    score1Text.resizeToFit = true;
    score1Text.text = String(player1Score);
    score1Text.color = 'white';
    score1Text.fontSize = 70;
    score1Text.fontFamily = 'Arial, Helvetica, sans-serif';
    score1Text.fontWeight = 'bold';
    score1Text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    score1Text.paddingRight = '6px';
    score1Text.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    player1Stack.addControl(score1Text);

    player1Container.addControl(player1Stack);

    // Player 2 container (top-left)
    const player2Container = new GUI.Rectangle();
    player2Container.width = '400px';
    player2Container.height = '200px';
    player2Container.thickness = 0;
    player2Container.background = 'transparent';
    player2Container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    player2Container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    player2Container.top = 10;
    player2Container.left = 20;
    guiTexture.addControl(player2Container);

    const player2Stack = new GUI.StackPanel();
    player2Stack.isVertical = true;
    player2Stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    player2Stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

    const Player2Info = new GUI.TextBlock();
    Player2Info.textWrapping = true;
    Player2Info.resizeToFit = true;
    Player2Info.text = player2Name;
    Player2Info.color = 'blue';
    Player2Info.fontSize = 48;
    Player2Info.fontFamily = 'Arial, Helvetica, sans-serif';
    Player2Info.fontWeight = 'bold';
    Player2Info.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    Player2Info.paddingLeft = '6px';
    player2Stack.addControl(Player2Info);

    const score2Text = new GUI.TextBlock();
    score2Text.textWrapping = true;
    score2Text.resizeToFit = true;
    score2Text.text = String(player2Score);
    score2Text.color = 'white';
    score2Text.fontSize = 70;
    score2Text.fontWeight = 'bold';
    score2Text.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    score2Text.paddingLeft = '6px';
    player2Stack.addControl(score2Text);

    player2Container.addControl(player2Stack);

    return {
        guiTexture,
        player1Container,
        Player1Info,
        score1Text,
        player2Container,
        Player2Info,
        score2Text,
        dispose: () => guiTexture.dispose(),
    };
}
