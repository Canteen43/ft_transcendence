export class UserNotFoundError extends Error {
	constructor(id: string) {
		super(`User not found: ${id}`);
		this.name = 'UserNotFoundError';
	}
}

export class SettingsNotFoundError extends Error {
	constructor(reference: string, id: string) {
		super(`Settings not found for ${reference}: ${id}`);
		this.name = 'SettingsNotFoundError';
	}
}

export class TournamentNotFoundError extends Error {
	constructor(reference: string, userId: string) {
		super(`Tournament not found for ${reference}: ${userId}`);
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

export class UserAlreadyExistsError extends Error {
	constructor(login: string) {
		super(`User already exists: ${login}`);
		this.name = 'UserAlreadyExistsError';
	}
}

export class UserAlreadyConnectedError extends Error {
	constructor(userId: string) {
		super(`User already connected: ${userId}`);
		this.name = 'UserAlreadyConnectedError';
	}
}

export class UserAlreadyQueuedError extends Error {
	constructor(userId: string) {
		super(`User already in queue: ${userId}`);
		this.name = 'UserAlreadyQueuedError';
	}
}

export class UserNotQueuedError extends Error {
	constructor(userId: string) {
		super(`User not in queue: ${userId}`);
		this.name = 'UserNotQueuedError';
	}
}

export class TwoFactorAlreadyEnabledError extends Error {
	constructor(id: string) {
		super(`Two factor authentication already enabled for user: ${id}`);
		this.name = 'TwoFactorAlreadyEnabledError';
	}
}

export class TwoFactorVerificationError extends Error {
	constructor(message: string) {
		super(message);
	}
}
