/**
 * Global game configuration utilities
 * Provides centralized access to sessionStorage game settings
 */

type PhysicsSettingKey =
	| 'ballRadius'
	| 'outOfBoundsDistance'
	| 'physicsTimeStep'
	| 'physicsSolverIterations'
	| 'ballAngleMultiplier'
	| 'angularReturnLimit'
	| 'serveAngleLimit'
	| 'paddleMass'
	| 'paddleForce'
	| 'paddleRange'
	| 'paddleMaxVelocity'
	| 'paddleBrakingFactor'
	| 'wallSpinFriction'
	| 'wallFriction'
	| 'wallNearParallelAngleThreshold'
	| 'wallNearParallelAngleAdjustment'
	| 'wallNearParallelMaxAngle'
	| 'ballBaseSpeed'
	| 'maxBallSpeed'
	| 'rallySpeedIncrementPercent';

const PHYSICS_SETTING_PREFIX = 'physics:';
const VISUAL_SETTING_PREFIX = 'visual:';

export class GameConfig {
	// Default values
	private static readonly DEFAULT_PLAYER_COUNT = 2;
	private static readonly DEFAULT_THIS_PLAYER = 1;
	private static readonly DEFAULT_GAME_MODE = 'local'; // Team convention: string values

	private static readonly DEFAULT_PHYSICS_SETTINGS: Record<PhysicsSettingKey, number> = {
		ballRadius: 0.32,
		outOfBoundsDistance: 20,
		physicsTimeStep: 1 / 240,
		physicsSolverIterations: 15,
		ballAngleMultiplier: 1.0,
		angularReturnLimit: Math.PI / 4,
		serveAngleLimit: (10 * Math.PI) / 180,
		paddleMass: 2.8,
		paddleForce: 15,
		paddleRange: 5,
		paddleMaxVelocity: 13,
		paddleBrakingFactor: 0.8,
		wallSpinFriction: 0.6,
		wallFriction: 0,
		wallNearParallelAngleThreshold: (10 * Math.PI) / 180,
		wallNearParallelAngleAdjustment: 0,
		wallNearParallelMaxAngle: (75 * Math.PI) / 180,
		ballBaseSpeed: 12,
		maxBallSpeed: 25,
		rallySpeedIncrementPercent: 11,
	};

	private static readonly DEFAULT_GLOW_BASE_INTENSITY = 3;

	// Debug/Logging controls
	private static readonly DEFAULT_DEBUG_LOGGING = false; // Master switch for all debug logging
	private static readonly DEFAULT_GAMESTATE_LOGGING = false; // Show gamestate updates even when debug is off

	// enable master to control all player paddles in remote games
	private static readonly DEFAULT_MASTER_CONTROL = false;

	private static getPhysicsSettingKey(key: PhysicsSettingKey): string {
		return `${PHYSICS_SETTING_PREFIX}${key}`;
	}

	private static getPhysicsSetting(key: PhysicsSettingKey): number {
		const storageKey = this.getPhysicsSettingKey(key);
		const stored = sessionStorage.getItem(storageKey);
		if (stored === null) return this.DEFAULT_PHYSICS_SETTINGS[key];
		const parsed = Number(stored);
		return Number.isFinite(parsed) ? parsed : this.DEFAULT_PHYSICS_SETTINGS[key];
	}

	private static setPhysicsSetting(
		key: PhysicsSettingKey,
		value: number
	): void {
		if (!Number.isFinite(value)) return;
		sessionStorage.setItem(this.getPhysicsSettingKey(key), value.toString());
	}

	private static getVisualSetting(key: string, fallback: number): number {
		const storageKey = `${VISUAL_SETTING_PREFIX}${key}`;
		const stored = sessionStorage.getItem(storageKey);
		if (stored === null) return fallback;
		const parsed = Number(stored);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	private static setVisualSetting(key: string, value: number): void {
		if (!Number.isFinite(value)) return;
		sessionStorage.setItem(`${VISUAL_SETTING_PREFIX}${key}`, value.toString());
	}

	/**
	 * Get the global player count from sessionStorage
	 */
	static getPlayerCount(): number {
		const stored = sessionStorage.getItem('playerCount');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 1 || parsed > 4
			? this.DEFAULT_PLAYER_COUNT
			: parsed;
	}

	/**
	 * Set the global player count in sessionStorage, not needed by game isnatnce but could be useful for menus
	 */
	static setPlayerCount(count: 1 | 2 | 3 | 4): void {
		sessionStorage.setItem('playerCount', count.toString());
		console.log(`🎮 Global player count set to: ${count}`);
	}

	/**
	 * Get the current player's POV from sessionStorage
	 */
	static getThisPlayer(): number {
		const stored = sessionStorage.getItem('thisPlayer');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 1 || parsed > 4
			? this.DEFAULT_THIS_PLAYER
			: parsed;
	}

	/**
	 * Set the current player's POV in sessionStorage
	 */
	static setThisPlayer(player: 1 | 2 | 3 | 4): void {
		sessionStorage.setItem('thisPlayer', player.toString());
		console.log(`🎮 This player POV set to: ${player}`);
	}

	/**
	 * Get game mode setting from sessionStorage (team convention: 'local' or 'remote')
	 */
	static getGameMode(): 'local' | 'remote' {
		const stored = sessionStorage.getItem('gameMode');
		return stored === 'remote' ? 'remote' : 'local'; // Default to 'local' if not set or invalid
	}

	/**
	 * Set game mode in sessionStorage (team convention: 'local' or 'remote')
	 */
	static setGameMode(mode: 'local' | 'remote'): void {
		sessionStorage.setItem('gameMode', mode);
		console.log(`🎮 Game mode set to: ${mode}`);
	}

	/**
	 * Check if game mode is local (convenience method for backward compatibility)
	 */
	static isLocalMode(): boolean {
		return this.getGameMode() === 'local';
	}

	/**
	 * Check if game mode is remote (convenience method)
	 */
	static isRemoteMode(): boolean {
		return this.getGameMode() === 'remote';
	}

	/**
	 * Get player name from sessionStorage
	 * Default names: Player 1 = "cat", Player 2 = "dog", Player 3 = "monkey", Player 4 = "goat"
	 */
	static getPlayerName(playerIndex: 1 | 2 | 3 | 4): string {
		const keys = ['alias1', 'alias2', 'alias3', 'alias4'];
		const defaultNames = ['player 1', 'player 2', 'player 3', 'player 4'];
		const stored = sessionStorage.getItem(keys[playerIndex - 1]);
		return stored || defaultNames[playerIndex - 1];
	}

	/**
	 * Get player UID from sessionStorage (stored as player1, player2, etc.)
	 */
	static getPlayerUID(playerIndex: 1 | 2 | 3 | 4): string | null {
		const keys = ['player1', 'player2', 'player3', 'player4'];
		return sessionStorage.getItem(keys[playerIndex - 1]);
	}

	/**
	 * Get all current game configuration as an object
	 */
	static getGameConfig() {
		return {
			playerCount: this.getPlayerCount(),
			thisPlayer: this.getThisPlayer(),
			gameMode: this.getGameMode(), // Team convention: 'local' or 'remote'
			isLocal: this.isLocalMode(), // Convenience boolean
			playerNames: [
				this.getPlayerName(1),
				this.getPlayerName(2),
				this.getPlayerName(3),
				this.getPlayerName(4),
			],
			playerUIDs: [
				this.getPlayerUID(1),
				this.getPlayerUID(2),
				this.getPlayerUID(3),
				this.getPlayerUID(4),
			],
			debugLogging: this.isDebugLoggingEnabled(),
			gamestateLogging: this.isGamestateLoggingEnabled(),
			masterControl: this.isMasterControlEnabled(),
		};
	}

	// Physics / tuning controls
	static getBallRadius(): number {
		return this.getPhysicsSetting('ballRadius');
	}

	static setBallRadius(value: number): void {
		this.setPhysicsSetting('ballRadius', Math.max(0.01, value));
	}

	static getOutOfBoundsDistance(): number {
		return this.getPhysicsSetting('outOfBoundsDistance');
	}

	static setOutOfBoundsDistance(value: number): void {
		this.setPhysicsSetting('outOfBoundsDistance', Math.max(1, value));
	}

	static getPhysicsTimeStep(): number {
		return this.getPhysicsSetting('physicsTimeStep');
	}

	static setPhysicsTimeStep(value: number): void {
		if (value > 0) {
			this.setPhysicsSetting('physicsTimeStep', value);
		}
	}

	static getPhysicsSolverIterations(): number {
		return this.getPhysicsSetting('physicsSolverIterations');
	}

	static setPhysicsSolverIterations(value: number): void {
		const clamped = Math.max(1, Math.min(200, Math.floor(value)));
		this.setPhysicsSetting('physicsSolverIterations', clamped);
	}

	static getBallAngleMultiplier(): number {
		return this.getPhysicsSetting('ballAngleMultiplier');
	}

	static setBallAngleMultiplier(value: number): void {
		const clamped = Math.max(0, Math.min(2, value));
		this.setPhysicsSetting('ballAngleMultiplier', clamped);
	}

	static getAngularReturnLimit(): number {
		return this.getPhysicsSetting('angularReturnLimit');
	}

	static setAngularReturnLimit(value: number): void {
		const clamped = Math.max(0, Math.min(Math.PI, value));
		this.setPhysicsSetting('angularReturnLimit', clamped);
	}

	static getServeAngleLimit(): number {
		return this.getPhysicsSetting('serveAngleLimit');
	}

	static setServeAngleLimit(value: number): void {
		const clamped = Math.max(0, Math.min(Math.PI / 2, value));
		this.setPhysicsSetting('serveAngleLimit', clamped);
	}

	static getPaddleMass(): number {
		return this.getPhysicsSetting('paddleMass');
	}

	static setPaddleMass(value: number): void {
		this.setPhysicsSetting('paddleMass', Math.max(0.01, value));
	}

	static getPaddleForce(): number {
		return this.getPhysicsSetting('paddleForce');
	}

	static setPaddleForce(value: number): void {
		this.setPhysicsSetting('paddleForce', Math.max(0, value));
	}

	static getPaddleRange(): number {
		return this.getPhysicsSetting('paddleRange');
	}

	static setPaddleRange(value: number): void {
		this.setPhysicsSetting('paddleRange', Math.max(0, value));
	}

	static getPaddleMaxVelocity(): number {
		return this.getPhysicsSetting('paddleMaxVelocity');
	}

	static setPaddleMaxVelocity(value: number): void {
		this.setPhysicsSetting('paddleMaxVelocity', Math.max(0, value));
	}

	static getPaddleBrakingFactor(): number {
		return this.getPhysicsSetting('paddleBrakingFactor');
	}

	static setPaddleBrakingFactor(value: number): void {
		const clamped = Math.max(0, Math.min(1, value));
		this.setPhysicsSetting('paddleBrakingFactor', clamped);
	}

	static getWallSpinFriction(): number {
		return this.getPhysicsSetting('wallSpinFriction');
	}

	static setWallSpinFriction(value: number): void {
		const clamped = Math.max(0, Math.min(1, value));
		this.setPhysicsSetting('wallSpinFriction', clamped);
	}

	static getWallFriction(): number {
		return this.getPhysicsSetting('wallFriction');
	}

	static setWallFriction(value: number): void {
		const clamped = Math.max(0, value);
		this.setPhysicsSetting('wallFriction', clamped);
	}

	static getWallNearParallelAngleThreshold(): number {
		return this.getPhysicsSetting('wallNearParallelAngleThreshold');
	}

	static setWallNearParallelAngleThreshold(value: number): void {
		const clamped = Math.max(0, Math.min(Math.PI / 2, value));
		this.setPhysicsSetting('wallNearParallelAngleThreshold', clamped);
	}

	static getWallNearParallelAngleAdjustment(): number {
		return this.getPhysicsSetting('wallNearParallelAngleAdjustment');
	}

	static setWallNearParallelAngleAdjustment(value: number): void {
		const clamped = Math.max(0, Math.min(Math.PI / 2, value));
		this.setPhysicsSetting('wallNearParallelAngleAdjustment', clamped);
	}

	static getWallNearParallelMaxAngle(): number {
		return this.getPhysicsSetting('wallNearParallelMaxAngle');
	}

	static setWallNearParallelMaxAngle(value: number): void {
		const clamped = Math.max(0, Math.min(Math.PI / 2, value));
		this.setPhysicsSetting('wallNearParallelMaxAngle', clamped);
	}

	static getBallBaseSpeed(): number {
		return this.getPhysicsSetting('ballBaseSpeed');
	}

	static setBallBaseSpeed(value: number): void {
		const clamped = Math.max(0.1, value);
		this.setPhysicsSetting('ballBaseSpeed', clamped);
		if (this.getMaxBallSpeed() < clamped) {
			this.setMaxBallSpeed(clamped);
		}
	}

	static getMaxBallSpeed(): number {
		return this.getPhysicsSetting('maxBallSpeed');
	}

	static setMaxBallSpeed(value: number): void {
		const base = this.getBallBaseSpeed();
		const clamped = Math.max(base, value);
		this.setPhysicsSetting('maxBallSpeed', clamped);
	}

	static getRallySpeedIncrementPercent(): number {
		return this.getPhysicsSetting('rallySpeedIncrementPercent');
	}

	static setRallySpeedIncrementPercent(value: number): void {
		const clamped = Math.max(0, Math.min(100, value));
		this.setPhysicsSetting('rallySpeedIncrementPercent', clamped);
	}

	static getGlowBaseIntensity(): number {
		return this.getVisualSetting(
			'glowBaseIntensity',
			this.DEFAULT_GLOW_BASE_INTENSITY
		);
	}

	static setGlowBaseIntensity(value: number): void {
		const clamped = Math.max(0, value);
		this.setVisualSetting('glowBaseIntensity', clamped);
	}

	/**
	 * Debug/Logging control methods
	 */
	static isDebugLoggingEnabled(): boolean {
		const stored = sessionStorage.getItem('debugLogging');
		return stored === 'true' ? true : this.DEFAULT_DEBUG_LOGGING;
	}

	static setDebugLogging(enabled: boolean): void {
		sessionStorage.setItem('debugLogging', enabled.toString());
		// Only log this change if we're enabling logging or if it was already enabled
		if (enabled || this.isDebugLoggingEnabled()) {
			console.log(`🎮 Debug logging ${enabled ? 'enabled' : 'disabled'}`);
		}
	}

	static isGamestateLoggingEnabled(): boolean {
		const stored = sessionStorage.getItem('gamestateLogging');
		return stored === 'false' ? false : this.DEFAULT_GAMESTATE_LOGGING;
	}

	static setGamestateLogging(enabled: boolean): void {
		sessionStorage.setItem('gamestateLogging', enabled.toString());
		console.log(`🎮 Gamestate logging ${enabled ? 'enabled' : 'disabled'}`);
	}

	static isMasterControlEnabled(): boolean {
		const stored = sessionStorage.getItem('masterControl');
		if (stored === 'true') return true;
		if (stored === 'false') return false;
		return this.DEFAULT_MASTER_CONTROL;
	}

	static setMasterControlEnabled(enabled: boolean): void {
		sessionStorage.setItem('masterControl', enabled.toString());
		console.log(`🎮 Master control ${enabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Initialize with default values if not set
	 */
	static initialize(): void {
		if (!sessionStorage.getItem('playerCount')) {
			this.setPlayerCount(this.DEFAULT_PLAYER_COUNT);
		}
		if (!sessionStorage.getItem('thisPlayer')) {
			this.setThisPlayer(this.DEFAULT_THIS_PLAYER);
		}
		if (!sessionStorage.getItem('gameMode')) {
			this.setGameMode(this.DEFAULT_GAME_MODE);
		}
		if (!sessionStorage.getItem('debugLogging')) {
			this.setDebugLogging(this.DEFAULT_DEBUG_LOGGING);
		}
		if (!sessionStorage.getItem('gamestateLogging')) {
			this.setGamestateLogging(this.DEFAULT_GAMESTATE_LOGGING);
		}
		if (!sessionStorage.getItem('masterControl')) {
			this.setMasterControlEnabled(this.DEFAULT_MASTER_CONTROL);
		}

		console.log('🎮 GameConfig initialized:', this.getGameConfig());
	}

	/**
	 * Clear all game configuration from sessionStorage
	 */
	static clear(): void {
		sessionStorage.removeItem('playerCount');
		sessionStorage.removeItem('thisPlayer');
		sessionStorage.removeItem('gameMode');
		sessionStorage.removeItem('alias1');
		sessionStorage.removeItem('alias2');
		sessionStorage.removeItem('alias3');
		sessionStorage.removeItem('alias4');
		sessionStorage.removeItem('player1');
		sessionStorage.removeItem('player2');
		sessionStorage.removeItem('player3');
		sessionStorage.removeItem('player4');
		sessionStorage.removeItem('debugLogging');
		sessionStorage.removeItem('gamestateLogging');
		sessionStorage.removeItem('aiSampleRate');
		sessionStorage.removeItem('aiCentralLimit');
		sessionStorage.removeItem('aiInputDurationBase');
		sessionStorage.removeItem('aiInputDurationScale');
		console.log('🎮 GameConfig cleared from sessionStorage');
	}

	// ============================================================================
	// AI CONFIGURATION
	// ============================================================================

	// Default AI values
	private static readonly DEFAULT_AI_SAMPLE_RATE = 10.0;
	private static readonly DEFAULT_AI_CENTRAL_LIMIT = 0.5;
	private static readonly DEFAULT_AI_INPUT_DURATION_BASE = 100;
	private static readonly DEFAULT_AI_INPUT_DURATION_SCALE = 1.0;
	private static readonly DEFAULT_AI_X_LIMIT = 5.0;

	/**
	 * Get AI sample rate (how often AI makes decisions per second)
	 */
	static getAISampleRate(): number {
		const stored = sessionStorage.getItem('aiSampleRate');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 0.1 || parsed > 10.0
			? this.DEFAULT_AI_SAMPLE_RATE
			: parsed;
	}

	/**
	 * Set AI sample rate
	 */
	static setAISampleRate(rate: number): void {
		const clamped = Math.max(0.1, Math.min(10.0, rate));
		sessionStorage.setItem('aiSampleRate', clamped.toString());
		console.log(`🤖 AI sample rate set to: ${clamped} Hz`);
	}

	/**
	 * Get AI central limit (deadzone where AI doesn't move)
	 */
	static getAICentralLimit(): number {
		const stored = sessionStorage.getItem('aiCentralLimit');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 0.1 || parsed > 2.0
			? this.DEFAULT_AI_CENTRAL_LIMIT
			: parsed;
	}

	/**
	 * Set AI central limit
	 */
	static setAICentralLimit(limit: number): void {
		const clamped = Math.max(0.1, Math.min(2.0, limit));
		sessionStorage.setItem('aiCentralLimit', clamped.toString());
		console.log(`🤖 AI central limit set to: ${clamped} units`);
	}

	/**
	 * Get AI input duration base (base pulse length in ms)
	 */
	static getAIInputDurationBase(): number {
		const stored = sessionStorage.getItem('aiInputDurationBase');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 50 || parsed > 1000
			? this.DEFAULT_AI_INPUT_DURATION_BASE
			: parsed;
	}

	/**
	 * Set AI input duration base
	 */
	static setAIInputDurationBase(duration: number): void {
		const clamped = Math.max(50, Math.min(1000, duration));
		sessionStorage.setItem('aiInputDurationBase', clamped.toString());
		console.log(`🤖 AI input duration base set to: ${clamped} ms`);
	}

	/**
	 * Get AI input duration scale (how much duration scales with distance)
	 */
	static getAIInputDurationScale(): number {
		const stored = sessionStorage.getItem('aiInputDurationScale');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 0.5 || parsed > 5.0
			? this.DEFAULT_AI_INPUT_DURATION_SCALE
			: parsed;
	}

	/**
	 * Set AI input duration scale
	 */
	static setAIInputDurationScale(scale: number): void {
		const clamped = Math.max(0.5, Math.min(5.0, scale));
		sessionStorage.setItem('aiInputDurationScale', clamped.toString());
		console.log(`🤖 AI input duration scale set to: ${clamped}x`);
	}

	/**
	 * Get AI X limit (maximum paddle movement range)
	 */
	static getAIXLimit(): number {
		const stored = sessionStorage.getItem('aiXLimit');
		const parsed = Number(stored);
		return isNaN(parsed) || parsed < 1.0 || parsed > 10.0
			? this.DEFAULT_AI_X_LIMIT
			: parsed;
	}

	/**
	 * Set AI X limit
	 */
	static setAIXLimit(limit: number): void {
		const clamped = Math.max(1.0, Math.min(10.0, limit));
		sessionStorage.setItem('aiXLimit', clamped.toString());
		console.log(`🤖 AI X limit set to: ${clamped} units`);
	}

	/**
	 * Get complete AI configuration object
	 */
	static getAIConfig() {
		return {
			sampleRate: this.getAISampleRate(),
			centralLimit: this.getAICentralLimit(),
			inputDurationBase: this.getAIInputDurationBase(),
			inputDurationScale: this.getAIInputDurationScale(),
			xLimit: this.getAIXLimit(),
		};
	}

	/**
	 * Set complete AI configuration
	 */
	static setAIConfig(config: {
		sampleRate?: number;
		centralLimit?: number;
		inputDurationBase?: number;
		inputDurationScale?: number;
		xLimit?: number;
	}): void {
		if (config.sampleRate !== undefined)
			this.setAISampleRate(config.sampleRate);
		if (config.centralLimit !== undefined)
			this.setAICentralLimit(config.centralLimit);
		if (config.inputDurationBase !== undefined)
			this.setAIInputDurationBase(config.inputDurationBase);
		if (config.inputDurationScale !== undefined)
			this.setAIInputDurationScale(config.inputDurationScale);
		if (config.xLimit !== undefined) this.setAIXLimit(config.xLimit);
		console.log('🤖 AI configuration updated');
	}
}
