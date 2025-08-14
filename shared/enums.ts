export enum TournamentStatus {
	Pending = 'pending',
	InProgress = 'in_progress',
	Finished = 'finished',
}

// Matches Postgres: match_status
export enum MatchStatus {
	Pending = 'pending',
	InProgress = 'in_progress',
	Finished = 'finished',
}

// Matches Postgres: participant_status
export enum ParticipantStatus {
	Creator = 'creator',
	Pending = 'pending',
	Accepted = 'accepted',
}
