export enum TournamentStatus {
	Pending = 'pending',
	InProgress = 'in_progress',
	Finished = 'finished',
	Cancelled = 'cancelled',
}

export enum MatchStatus {
	Pending = 'pending',
	InProgress = 'in_progress',
	Finished = 'finished',
	Cancelled = 'cancelled',
	Paused = 'paused',
}

export enum PlayerStatus {
	Creator = 'creator',
	Pending = 'pending',
	Accepted = 'accepted',
}

export enum Token {
	TwoFactor = '2fa',
	Auth = 'authenticated',
}

export enum QuitReason {
	Quit = 0,
	Disconnect = 1,
	Error = 2,
}
