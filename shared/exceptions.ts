export class SettingsNotFoundError extends Error {
	constructor(userId: string) {
		super(`Settings not found for user: ${userId}`);
		this.name = "SettingsNotFoundError";
	}
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SettingsNotFoundError";
	}
}
