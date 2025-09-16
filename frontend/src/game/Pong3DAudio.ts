import * as BABYLON from '@babylonjs/core';
import { conditionalError, conditionalWarn } from './Logger';

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
	private audioEngine: any = null; // Babylon audio engine
	private settings: AudioSettings = {
		masterVolume: 1.0,
		sfxVolume: 0.8,
		musicVolume: 0.6,
		enabled: true,
	};

	// Audio assets - using new audio engine format
	private sounds: Map<string, any> = new Map(); // Will store audio sources
	private backgroundMusic: any = null;

	// Musical harmony arrays (in cents)
	private readonly PADDLE_HARMONICS = [0, 386, 702, 1200]; // Major chord: Root, Maj3rd, 5th, Octave
	private readonly WALL_HARMONICS = [-500, -114, 202, -700]; // Lower harmonic series around -500 cents

	constructor(settings?: Partial<AudioSettings>) {
		if (settings) {
			this.settings = { ...this.settings, ...settings };
		}
	}

	/** Set the scene reference for audio operations */
	public async setScene(scene: BABYLON.Scene): Promise<void> {
		this.scene = scene;

		// Initialize Babylon.js audio engine using modern API
		try {
			this.audioEngine = await BABYLON.CreateAudioEngineAsync();
		} catch (error) {
			conditionalWarn(
				'🔊 Failed to initialize Babylon.js audio engine:',
				error
			);
		}
	}

	/** Play a sound effect with optional pitch and volume modification */
	public async playSoundEffect(
		name: string,
		options: { pitch?: number; volume?: number } = {}
	): Promise<void> {
		if (!this.settings.enabled || !this.audioEngine) {
			return;
		}

		const sound = this.sounds.get(name);
		if (!sound) {
			return;
		}

		try {
			// Wait for the audio engine to unlock (handles user interaction automatically)
			await this.audioEngine.unlockAsync();

			// Set volume (use custom volume or default)
			const volume =
				options.volume !== undefined
					? options.volume
					: this.settings.sfxVolume * this.settings.masterVolume;
			sound.setVolume(volume);

			// Set pitch in cents if specified (0 = original pitch)
			if (options.pitch !== undefined) {
				sound.pitch = options.pitch;
			} else {
				sound.pitch = 0; // Reset to original pitch
			}

			sound.play();
		} catch (error) {
			conditionalError(`🔊 Failed to play sound ${name}:`, error);
		}
	}

	/** Play a sound effect with a random harmonic pitch variation */
	public async playSoundEffectWithHarmonic(
		name: string,
		harmonicType: 'paddle' | 'wall',
		options: { volume?: number } = {}
	): Promise<void> {
		// Select random harmonic from the appropriate set
		const harmonics =
			harmonicType === 'paddle'
				? this.PADDLE_HARMONICS
				: this.WALL_HARMONICS;
		const randomIndex = Math.floor(Math.random() * harmonics.length);
		const pitch = harmonics[randomIndex];

		// Play with the selected harmonic pitch
		await this.playSoundEffect(name, {
			pitch: pitch,
			volume: options.volume,
		});
	}

	/** Play a sound effect with pitch modification */
	public async playSoundEffectWithPitch(
		name: string,
		pitchCents: number
	): Promise<void> {
		if (!this.settings.enabled || !this.audioEngine) {
			return;
		}

		const sound = this.sounds.get(name);
		if (!sound) {
			return;
		}

		try {
			// Wait for the audio engine to unlock
			await this.audioEngine.unlockAsync();

			// Set volume and pitch
			sound.setVolume(
				this.settings.sfxVolume * this.settings.masterVolume
			);

			// Set pitch in cents (100 cents = 1 semitone, 1200 cents = 1 octave)
			// Negative values lower the pitch, positive values raise it
			sound.pitch = pitchCents;

			sound.play();
		} catch (error) {
			conditionalError(
				`🔊 Failed to play sound ${name} with pitch ${pitchCents}:`,
				error
			);
		}
	}

	/** Load all game audio assets */
	public async loadAudioAssets(): Promise<void> {
		if (!this.scene) {
			return;
		}

		try {
			// Load sound effects from sounds folder
			await this.loadSoundEffect('ping', './src/game/sounds/ping.mp3');
			await this.loadSoundEffect('goal', './src/game/sounds/goal.mp3');
			await this.loadSoundEffect(
				'victory',
				'./src/game/sounds/victory.mp3'
			);
		} catch (error) {
			conditionalWarn('🔊 Audio loading failed:', error);
		}
	}

	/** Load a single sound effect using modern Babylon.js API */
	private async loadSoundEffect(name: string, url: string): Promise<void> {
		if (!this.audioEngine) {
			return;
		}

		try {
			const sound = await BABYLON.CreateSoundAsync(name, url);
			this.sounds.set(name, sound);
		} catch (error) {
			conditionalWarn(`🔊 Failed to load sound ${name}:`, error);
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

	/** Test audio playback - force play a sound for debugging */
	public testAudio(): void {
		const pingSound = this.sounds.get('ping');
		if (pingSound) {
			pingSound.setVolume(1.0);
			pingSound.play();
		}
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
