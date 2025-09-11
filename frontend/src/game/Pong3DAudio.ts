import * as BABYLON from '@babylonjs/core';

/**
 * Pong3DAudio - Handles all game audio including sound effects and background music
 * Uses the "borrowed reference" pattern like other Pong3D modules
 */

export interface AudioSettings {
	masterVolume: number;
	sfxVolume: number;
	musicVolume: number;
	enabled: boolean;
}

export class Pong3DAudio {
	private scene: BABYLON.Scene | null = null;
	private settings: AudioSettings = {
		masterVolume: 1.0,
		sfxVolume: 0.8,
		musicVolume: 0.6,
		enabled: true,
	};

	// Audio assets
	private sounds: Map<string, BABYLON.Sound> = new Map();
	private backgroundMusic: BABYLON.Sound | null = null;

	constructor(settings?: Partial<AudioSettings>) {
		if (settings) {
			this.settings = { ...this.settings, ...settings };
		}
	}

	/** Set the scene reference for audio operations */
	public setScene(scene: BABYLON.Scene): void {
		this.scene = scene;
	}

	/** Load all game audio assets */
	public async loadAudioAssets(): Promise<void> {
		if (!this.scene) {
			console.warn('🔊 Cannot load audio: scene not set');
			return;
		}

		try {
			// Load sound effects
			await this.loadSoundEffect('paddle_hit', '/audio/paddle_hit.wav');
			await this.loadSoundEffect('wall_bounce', '/audio/wall_bounce.wav');
			await this.loadSoundEffect('goal_score', '/audio/goal_score.wav');
			await this.loadSoundEffect('game_start', '/audio/game_start.wav');
			await this.loadSoundEffect('game_end', '/audio/game_end.wav');

			// Load background music
			await this.loadBackgroundMusic('/audio/background_music.mp3');

			console.log('🔊 Audio assets loaded successfully');
		} catch (error) {
			console.warn('🔊 Audio loading failed:', error);
		}
	}

	/** Load a single sound effect */
	private async loadSoundEffect(name: string, url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const sound = new BABYLON.Sound(
				name,
				url,
				this.scene,
				() => {
					this.sounds.set(name, sound);
					resolve();
				},
				{
					volume:
						this.settings.sfxVolume * this.settings.masterVolume,
					autoplay: false,
				}
			);

			// Handle loading errors
			setTimeout(() => {
				if (!this.sounds.has(name)) {
					console.warn(`🔊 Failed to load sound: ${name}`);
					reject(new Error(`Failed to load ${name}`));
				}
			}, 5000); // 5 second timeout
		});
	}

	/** Load background music */
	private async loadBackgroundMusic(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.backgroundMusic = new BABYLON.Sound(
				'background_music',
				url,
				this.scene,
				() => {
					resolve();
				},
				{
					volume:
						this.settings.musicVolume * this.settings.masterVolume,
					autoplay: false,
					loop: true,
				}
			);

			// Handle loading errors with timeout
			setTimeout(() => {
				if (!this.backgroundMusic || !this.backgroundMusic.isReady) {
					console.warn('🔊 Failed to load background music');
					reject(new Error('Failed to load background music'));
				}
			}, 5000); // 5 second timeout
		});
	}

	/** Play a sound effect */
	public playSoundEffect(name: string): void {
		if (!this.settings.enabled) return;

		const sound = this.sounds.get(name);
		if (sound) {
			sound.play();
		} else {
			console.warn(`🔊 Sound effect not found: ${name}`);
		}
	}

	/** Start background music */
	public startBackgroundMusic(): void {
		if (!this.settings.enabled || !this.backgroundMusic) return;

		if (!this.backgroundMusic.isPlaying) {
			this.backgroundMusic.play();
		}
	}

	/** Stop background music */
	public stopBackgroundMusic(): void {
		if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
			this.backgroundMusic.stop();
		}
	}

	/** Update audio settings */
	public updateSettings(newSettings: Partial<AudioSettings>): void {
		this.settings = { ...this.settings, ...newSettings };

		// Update all sound volumes
		this.sounds.forEach(sound => {
			sound.setVolume(
				this.settings.sfxVolume * this.settings.masterVolume
			);
		});

		if (this.backgroundMusic) {
			this.backgroundMusic.setVolume(
				this.settings.musicVolume * this.settings.masterVolume
			);
		}
	}

	/** Get current audio settings */
	public getSettings(): AudioSettings {
		return { ...this.settings };
	}

	/** Dispose of all audio resources */
	public dispose(): void {
		this.sounds.forEach(sound => sound.dispose());
		this.sounds.clear();

		if (this.backgroundMusic) {
			this.backgroundMusic.dispose();
			this.backgroundMusic = null;
		}
	}
}
