export class SettingsNotFoundError extends Error {
	constructor(reference: string, id: string) {
		super(`Settings not found for ${reference}: ${id}`);
		this.name = 'SettingsNotFoundError';
	}
}

export class TournamentNotFoundError extends Error {
	constructor(userId: string) {
		super(`Tournament not found: ${userId}`);
		this.name = 'TournamentNotFoundError';
	}
}

export class MatchNotFoundError extends Error {
	constructor(id?: string) {
		if (id) super(`Match not found: ${id}`);
		else super('Match not found');
		this.name = 'MatchNotFoundError';
	}
}

export class MatchNotReadyError extends Error {
	constructor(id: string) {
		super(`Match not ready to start: ${id}`);
		this.name = 'MatchNotReadyError';
	}
}

export class ParticipantNotFoundError extends Error {
	constructor(reference: string, id: string) {
		super(`Participant not found for ${reference}: ${id}`);
		this.name = 'ParticipantNotFoundError';
	}
}

export class ConnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConnectionError';
	}
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export class ProtocolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProtocolError';
	}
}

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export class AuthenticationFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}
