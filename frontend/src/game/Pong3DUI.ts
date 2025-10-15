// UI helper for Pong3D: builds GUI controls and returns references so the main scene can wire them
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import montserratBoldUrl from '../../fonts/montserrat/Montserrat-Bold.ttf';
import { isMobileInputEnabled } from './MobileControlsOverlay';
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
	positions?: ('top' | 'bottom' | 'left' | 'right')[]; // deprecated: no longer used
}

export interface Pong3DUIHandles {
	guiTexture: GUI.AdvancedDynamicTexture;
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
	const isMobile = isMobileInputEnabled();
	const texturesToDispose = new Set<GUI.AdvancedDynamicTexture>();
	texturesToDispose.add(guiTexture);
	ensureMeshUIFontLoaded();

	// No legacy 2D containers; fullscreen ADT is kept only for winner overlay

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
			underline?: {
				color?: string;
				thickness?: number;
				width?: string;
				offset?: string;
			};
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
			true
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

		if (options?.underline) {
			const underline = new GUI.Rectangle(`${controlName}-underline`);
			underline.height = `${options.underline.thickness ?? 24}px`;
			underline.width = options.underline.width ?? '15%';
			const underlineColor = options.underline.color ?? 'white';
			underline.background = underlineColor;
			underline.color = underlineColor;
			underline.thickness = 0;
			underline.verticalAlignment =
				GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
			underline.horizontalAlignment =
				GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
			underline.top = options.underline.offset ?? '-40px';
			container.addControl(underline);
		}

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
		name.fontSize = isMobile ? 22 : 44;
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
		score.fontSize = isMobile ? 25 : 50;
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
					fontSize: isMobile ? 110 : 220,
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
					fontSize: isMobile ? 180 : 360,
					color: 'white',
					shadowColor: 'rgba(0, 0, 0, 0.7)',
					shadowBlur: 12,
					shadowOffsetX: 4,
					shadowOffsetY: 4,
					width: 960,
					height: 320,
					textVerticalAlignment:
						GUI.Control.VERTICAL_ALIGNMENT_CENTER,
					normalizeBaseline: true,
					underline: {
						color: 'white',
						thickness: 70,
						width: '15%',
						offset: '-60px',
					},
				}
			);
			meshBindings.score = primary;
			if (primary) {
				trackedScore = primary.text;

				// Share the same material/texture with any additional score meshes
				const sharedMaterial = meshTarget.scoreMeshes[0].material;
				meshTarget.scoreMeshes.slice(1).forEach(mesh => {
					if (sharedMaterial) {
						mesh.material = sharedMaterial;
					}
				});
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

	// No-op move function kept for compatibility with callers
	function movePlayerTo(
		_playerIndex: number,
		_position: 'top' | 'bottom' | 'left' | 'right'
	) {
		// Intentionally empty: legacy 2D positioning removed
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
