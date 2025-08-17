export class SettingsNotFoundError extends Error {
	constructor(userId: string) {
		super(`Settings not found for user: ${userId}`);
		this.name = 'SettingsNotFoundError';
	}
}

export class TournamentNotFoundError extends Error {
	constructor(userId: string) {
		super(`Tournament not found: ${userId}`);
		this.name = 'TournamentNotFoundError';
	}
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}
