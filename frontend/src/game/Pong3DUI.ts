// UI helper for Pong3D: builds GUI controls and returns references so the main scene can wire them
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import montserratBoldUrl from '../../fonts/montserrat/Montserrat-Bold.ttf';
import { conditionalWarn } from './Logger';

const MESH_UI_FONT_FAMILY = 'MontserratBold';
const MESH_UI_FONT_URL: string = montserratBoldUrl;

let meshUIFontPromise: Promise<void> | null = null;

function ensureMeshUIFontLoaded(): void {
	if (typeof document === 'undefined' || typeof FontFace === 'undefined')
		return;
	if (meshUIFontPromise) return;
	try {
		const face = new FontFace(
			MESH_UI_FONT_FAMILY,
			`url(${MESH_UI_FONT_URL})`
		);
		meshUIFontPromise = face
			.load()
			.then(loaded => {
				document.fonts.add(loaded);
			})
			.catch(err => {
				conditionalWarn('Failed to load mesh UI font', err);
			});
	} catch (err) {
		conditionalWarn('Could not initialize mesh UI font loader', err);
	}
}

interface PlayerMeshTargets {
	aliasMesh: BABYLON.AbstractMesh | null;
	scoreMeshes: BABYLON.AbstractMesh[];
}

interface MeshTextBinding {
	texture: GUI.AdvancedDynamicTexture;
	text: GUI.TextBlock;
}

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
	// Winner display
	winnerMessage: GUI.TextBlock;
	movePlayerTo: (
		playerIndex: number,
		position: 'top' | 'bottom' | 'left' | 'right'
	) => void;
	showWinner: (playerIndex: number, playerName: string) => void;
	hideWinner: () => void;
	dispose: () => void;
}

export function createPong3DUI(
	_scene: BABYLON.Scene,
	opts?: Pong3DUIOptions
): Pong3DUIHandles {
	const names = opts?.playerNames ?? [
		'Player1',
		'Player2',
		'Player3',
		'Player4',
	];
	const scores = opts?.playerScores ?? [0, 0, 0, 0];
	const positions = opts?.positions ?? ['bottom', 'top', 'right', 'left'];

	const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
	const texturesToDispose = new Set<GUI.AdvancedDynamicTexture>();
	texturesToDispose.add(guiTexture);
	ensureMeshUIFontLoaded();

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
	bottomContainer.horizontalAlignment =
		GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
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
	const meshTargets: PlayerMeshTargets[] = names.map((_, idx) => {
		const aliasName = `alias${idx + 1}`;
		const aliasMesh = _scene.getMeshByName(
			aliasName
		) as BABYLON.AbstractMesh | null;
		const scoreMeshes: BABYLON.AbstractMesh[] = [];
		const base = idx + 1;
		const candidateNames = [
			`score${base}`,
			`score${base}.1`,
			`score${base}.2`,
			`score${base}_1`,
			`score${base}_2`,
		];
		candidateNames.forEach(candidate => {
			const mesh = _scene.getMeshByName(
				candidate
			) as BABYLON.AbstractMesh | null;
			if (mesh && !scoreMeshes.includes(mesh)) {
				scoreMeshes.push(mesh);
			}
		});
		return { aliasMesh, scoreMeshes } as PlayerMeshTargets;
	});
	const usesMeshTargets: boolean[] = new Array(names.length).fill(false);

	const attachTextToMesh = (
		mesh: BABYLON.AbstractMesh | null,
		controlName: string,
		initialText: string,
		options?: {
			fontSize?: number;
			color?: string;
			background?: string;
			fontFamily?: string;
			shadowColor?: string;
			shadowBlur?: number;
			shadowOffsetX?: number;
			shadowOffsetY?: number;
			width?: number;
			height?: number;
			textVerticalAlignment?: number;
			paddingTop?: string;
			paddingBottom?: string;
			containerPaddingTop?: string;
			containerPaddingBottom?: string;
			lineSpacing?: string;
			normalizeBaseline?: boolean;
		}
	): MeshTextBinding | null => {
		if (!mesh) return null;
		const width = options?.width ?? 1024;
		const height = options?.height ?? 256;
		const texture = GUI.AdvancedDynamicTexture.CreateForMesh(
			mesh,
			width,
			height,
			false,
			1
		);
		texture.name = `${controlName}-adt`;
		texture.renderAtIdealSize = true;
		texturesToDispose.add(texture);

		const container = new GUI.Rectangle(`${controlName}-rect`);
		container.background = options?.background ?? 'transparent';
		container.thickness = 0;
		container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		container.width = '100%';
		container.height = '100%';
		if (options?.containerPaddingTop)
			container.paddingTop = options.containerPaddingTop;
		if (options?.containerPaddingBottom)
			container.paddingBottom = options.containerPaddingBottom;
		texture.addControl(container);

		const textBlock = new GUI.TextBlock(`${controlName}-text`, initialText);
		textBlock.color = options?.color ?? 'white';
		textBlock.fontSize = options?.fontSize ?? 90;
		textBlock.fontWeight = 'bold';
		textBlock.fontFamily =
			options?.fontFamily ?? `${MESH_UI_FONT_FAMILY}, Arial, sans-serif`;
		textBlock.textHorizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		textBlock.textVerticalAlignment =
			options?.textVerticalAlignment ??
			GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		textBlock.width = '100%';
		textBlock.height = '100%';
		textBlock.textWrapping = false;
		textBlock.resizeToFit = false;
		textBlock.paddingTop = options?.paddingTop ?? '0px';
		textBlock.paddingBottom = options?.paddingBottom ?? '0px';
		textBlock.paddingLeft = '0px';
		textBlock.paddingRight = '0px';
		textBlock.lineSpacing = options?.lineSpacing ?? '0px';
		textBlock.top = '0px';
		textBlock.left = '0px';
		if (options?.shadowColor) {
			textBlock.shadowColor = options.shadowColor;
			textBlock.shadowBlur = options.shadowBlur ?? 4;
			textBlock.shadowOffsetX = options.shadowOffsetX ?? 2;
			textBlock.shadowOffsetY = options.shadowOffsetY ?? 2;
		}

		if (options?.normalizeBaseline) {
			const normalize = () => {
				try {
					const size = texture.getSize();
					const fontOffset = (textBlock as any)._fontOffset as
						| { height: number; ascent: number; descent: number }
						| undefined;
					if (fontOffset && size?.height) {
						const usedHeight = fontOffset.height;
						const targetCenter = size.height / 2;
						const glyphCenter = usedHeight / 2 - fontOffset.descent;
						const offset = targetCenter - glyphCenter;
						textBlock.paddingTop = `${offset}px`;
						textBlock.paddingBottom = '0px';
						return;
					}
					const measure = (textBlock as any)._currentMeasure as
						| { height: number; top: number }
						| undefined;
					if (measure && size?.height) {
						const unused = size.height - measure.height;
						const offset = unused * 0.5 - (measure.top ?? 0);
						textBlock.paddingTop = `${offset}px`;
						textBlock.paddingBottom = '0px';
					}
				} catch (err) {
					conditionalWarn('Failed to normalize text baseline', err);
				}
			};
			normalize();
			textBlock.onTextChangedObservable.add(normalize);
			textBlock.onAfterDrawObservable.add(normalize);
		}
		container.addControl(textBlock);

		return {
			texture,
			text: textBlock,
		};
	};

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
		const colors = ['red', '#5bc8ff', 'lightgreen', 'cyan'];
		const playerColor = colors[idx] ?? 'white';
		name.color = playerColor;
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

		let trackedName = name;
		let trackedScore = score;
		const meshTarget = meshTargets[idx];
		const meshBindings: {
			alias?: MeshTextBinding | null;
			score?: MeshTextBinding | null;
			scoreMirrors: GUI.TextBlock[];
		} = {
			scoreMirrors: [],
		};

		if (meshTarget?.aliasMesh) {
			meshBindings.alias = attachTextToMesh(
				meshTarget.aliasMesh,
				`alias${idx + 1}`,
				name.text,
				{
					color: playerColor,
					fontSize: 220,
					shadowColor: 'rgba(0, 0, 0, 0.65)',
					shadowBlur: 10,
					shadowOffsetX: 4,
					shadowOffsetY: 4,
					width: 768,
					height: 256,
					textVerticalAlignment:
						GUI.Control.VERTICAL_ALIGNMENT_CENTER,
				}
			);
			if (meshBindings.alias) {
				trackedName = meshBindings.alias.text;
			}
		}

		if (meshTarget?.scoreMeshes?.length) {
			const primary = attachTextToMesh(
				meshTarget.scoreMeshes[0],
				`score${idx + 1}-primary`,
				score.text,
				{
					fontSize: 400,
					color: 'white',
					shadowColor: 'rgba(0, 0, 0, 0.7)',
					shadowBlur: 12,
					shadowOffsetX: 4,
					shadowOffsetY: 4,
					width: 768,
					height: 256,
					textVerticalAlignment:
						GUI.Control.VERTICAL_ALIGNMENT_CENTER,
					normalizeBaseline: true,
				}
			);
			meshBindings.score = primary;
			if (primary) {
				trackedScore = primary.text;

				meshTarget.scoreMeshes.slice(1).forEach((mesh, mirrorIdx) => {
					const mirror = attachTextToMesh(
						mesh,
						`score${idx + 1}-mirror${mirrorIdx + 1}`,
						score.text,
						{
							fontSize: 400,
							color: 'white',
							shadowColor: 'rgba(0, 0, 0, 0.7)',
							shadowBlur: 12,
							shadowOffsetX: 4,
							shadowOffsetY: 4,
							width: 768,
							height: 256,
							textVerticalAlignment:
								GUI.Control.VERTICAL_ALIGNMENT_CENTER,
							normalizeBaseline: true,
						}
					);
					if (mirror) {
						meshBindings.scoreMirrors.push(mirror.text);
					}
				});

				if (meshBindings.scoreMirrors.length) {
					const syncMirrors = () => {
						const value = trackedScore.text;
						meshBindings.scoreMirrors.forEach(mirror => {
							if (mirror.text !== value) {
								mirror.text = value;
							}
						});
					};
					primary.text.onTextChangedObservable.add(syncMirrors);
					syncMirrors();
				}
			}
		}

		const aliasOnMesh = Boolean(meshBindings.alias);
		const scoreOnMesh = Boolean(
			meshBindings.score || meshBindings.scoreMirrors.length
		);

		if (aliasOnMesh) {
			name.isVisible = false;
		}
		if (scoreOnMesh) {
			score.isVisible = false;
		}

		if (aliasOnMesh && scoreOnMesh) {
			usesMeshTargets[idx] = true;
		}
		stack.isVisible = !usesMeshTargets[idx];

		playerStacks.push(stack);
		playerNameTexts.push(trackedName);
		playerScoreTexts.push(trackedScore);
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

	function movePlayerTo(
		playerIndex: number,
		position: 'top' | 'bottom' | 'left' | 'right'
	) {
		if (playerIndex < 0 || playerIndex >= playerStacks.length) return;
		const stack = playerStacks[playerIndex];
		if (!stack) return;
		if (usesMeshTargets[playerIndex]) {
			const prevParent = currentParent[playerIndex];
			try {
				if (
					prevParent &&
					typeof (prevParent as any).removeControl === 'function'
				) {
					(prevParent as any).removeControl(stack);
				}
			} catch (e) {}
			currentParent[playerIndex] = null;
			stack.isVisible = false;
			return;
		}
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
			conditionalWarn('Failed to move player stack', e);
		}
		// COMPLETE STYLE RESET: Ensure all properties are reset to defaults before applying position-specific styling
		const isSide = position === 'left' || position === 'right';
		const name = playerNameTexts[playerIndex];
		const score = playerScoreTexts[playerIndex];

		// Reset all position-dependent properties to defaults
		stack.left = 0;
		stack.width = 'auto';
		stack.height = '120px';
		stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;

		name.left = 0;
		name.paddingRight = '6px';
		name.paddingLeft = '0px';
		name.width = '100%';
		name.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		name.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		name.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		name.textWrapping = true;
		name.resizeToFit = true;

		score.left = 0;
		score.paddingLeft = '0px';
		score.width = 'auto';
		score.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		score.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		score.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		score.textWrapping = false;
		score.resizeToFit = false;

		// Now apply position-specific styling
		if (isSide) {
			// left/right: stack vertical, align text left/right
			stack.isVertical = true;
			stack.horizontalAlignment =
				position === 'left'
					? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
					: GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			// make stack fill the container so child controls with 100% width are visible
			stack.width = '100%';
			stack.left = 0;
			name.textHorizontalAlignment =
				position === 'left'
					? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
					: GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			score.textHorizontalAlignment =
				position === 'left'
					? GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
					: GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
			// padding and width: make name take container width so it wraps nicely, score centered below
			name.paddingRight = '6px';
			// Use explicit positioning instead of text alignment for scores
			if (position === 'left') {
				score.horizontalAlignment =
					GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
				score.left = '0px'; // move 20px further left (was 10px, now -10px)
				score.textHorizontalAlignment =
					GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			} else {
				score.horizontalAlignment =
					GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
				score.left = '-10px'; // move 5px further right (was -10px, now -15px)
				score.textHorizontalAlignment =
					GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
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
			stack.verticalAlignment =
				position === 'top'
					? GUI.Control.VERTICAL_ALIGNMENT_TOP
					: GUI.Control.VERTICAL_ALIGNMENT_CENTER;
			// set fixed width to match content (name + score + padding)
			stack.width = '370px';
			stack.left = 0;
			// for horizontal layout, let text align naturally in their containers
			name.textHorizontalAlignment =
				GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
			score.textHorizontalAlignment =
				GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
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

	// Create winner message (initially hidden)
	const winnerMessage = new GUI.TextBlock();
	winnerMessage.text = '';
	winnerMessage.color = 'white';
	winnerMessage.fontSize = '80px';
	winnerMessage.fontFamily = 'Arial';
	winnerMessage.fontWeight = 'bold';
	winnerMessage.textHorizontalAlignment =
		GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	winnerMessage.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	winnerMessage.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
	winnerMessage.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
	// Add text effects
	winnerMessage.outlineColor = 'white';
	winnerMessage.outlineWidth = 4;
	winnerMessage.shadowColor = 'rgba(0, 0, 0, 0.7)';
	winnerMessage.shadowOffsetX = 3;
	winnerMessage.shadowOffsetY = 3;
	winnerMessage.shadowBlur = 5;
	winnerMessage.isVisible = false;
	guiTexture.addControl(winnerMessage);

	// Function to show winner
	const showWinner = (playerIndex: number, playerName: string) => {
		const colors = ['red', '#5bc8ff', 'lightgreen', 'cyan'];
		const color = colors[playerIndex] || 'white';
		winnerMessage.text = `${playerName} WINS!`;
		winnerMessage.color = color;
		winnerMessage.isVisible = true;
	};

	// Function to hide winner
	const hideWinner = () => {
		winnerMessage.isVisible = false;
	};

	return {
		guiTexture,
		topContainer,
		bottomContainer,
		leftContainer,
		rightContainer,
		playerStacks,
		playerNameTexts,
		playerScoreTexts,
		winnerMessage,
		movePlayerTo,
		showWinner,
		hideWinner,
		dispose: () => {
			texturesToDispose.forEach(texture => {
				try {
					texture.dispose();
				} catch (err) {
					conditionalWarn('Failed to dispose UI texture', err);
				}
			});
		},
	};
}
