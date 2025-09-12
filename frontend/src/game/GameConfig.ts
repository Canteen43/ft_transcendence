/**
 * Global game configuration utilities
 * Provides centralized access to sessionStorage game settings
 */

export class GameConfig {
	// Default values
	private static readonly DEFAULT_PLAYER_COUNT = 2;
	private static readonly DEFAULT_THIS_PLAYER = 1;
	private static readonly DEFAULT_GAME_MODE = 'remote'; // Team convention: string values

	// Debug/Logging controls
	private static readonly DEFAULT_DEBUG_LOGGING = true; // Master switch for all debug logging
	private static readonly DEFAULT_GAMESTATE_LOGGING = true; // Show gamestate updates even when debug is off

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
		const keys = [
			'player1Name',
			'player2Name',
			'player3Name',
			'player4Name',
		];
		const defaultNames = ['cat', 'dog', 'monkey', 'goat'];
		const stored = sessionStorage.getItem(keys[playerIndex - 1]);
		return stored || defaultNames[playerIndex - 1];
	}

	/**
	 * Set player name in sessionStorage
	 */
	static setPlayerName(playerIndex: 1 | 2 | 3 | 4, name: string): void {
		const keys = [
			'player1Name',
			'player2Name',
			'player3Name',
			'player4Name',
		];
		sessionStorage.setItem(keys[playerIndex - 1], name);
		console.log(`🎮 Player ${playerIndex} name set to: ${name}`);
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
			debugLogging: this.isDebugLoggingEnabled(),
			gamestateLogging: this.isGamestateLoggingEnabled(),
		};
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

		console.log('🎮 GameConfig initialized:', this.getGameConfig());
	}

	/**
	 * Clear all game configuration from sessionStorage
	 */
	static clear(): void {
		sessionStorage.removeItem('playerCount');
		sessionStorage.removeItem('thisPlayer');
		sessionStorage.removeItem('gameMode');
		sessionStorage.removeItem('player1Name');
		sessionStorage.removeItem('player2Name');
		sessionStorage.removeItem('player3Name');
		sessionStorage.removeItem('player4Name');
		sessionStorage.removeItem('debugLogging');
		sessionStorage.removeItem('gamestateLogging');
		console.log('🎮 GameConfig cleared from sessionStorage');
	}
}
