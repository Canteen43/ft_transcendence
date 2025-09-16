/**
 * Conditional logging utilities that respect GameConfig debug settings
 * Provides standalone functions for files that don't inherit from Pong3D
 */

import { GameConfig } from './GameConfig';

/**
 * Conditional console.log that only logs when debug logging is enabled
 */
export function conditionalLog(...args: any[]): void {
	if (GameConfig.isDebugLoggingEnabled()) {
		console.log(...args);
	}
}

/**
 * Conditional console.warn that only logs when debug logging is enabled
 */
export function conditionalWarn(...args: any[]): void {
	if (GameConfig.isDebugLoggingEnabled()) {
		console.warn(...args);
	}
}

/**
 * Conditional console.error that only logs when debug logging is enabled
 */
export function conditionalError(...args: any[]): void {
	if (GameConfig.isDebugLoggingEnabled()) {
		console.error(...args);
	}
}
