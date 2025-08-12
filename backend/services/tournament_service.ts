import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import * as matchSchemas from '../../shared/schemas/match.js'
import * as participantSchemas from '../../shared/schemas/participant.js'
import * as tournamentSchemas from '../../shared/schemas/tournament.js'
import { ParticipantStatus } from '../../shared/enums.js';
import { TournamentStatus } from '../../shared/enums.js';
import { DatabaseError, SettingsNotFoundError } from '../../shared/exceptions.js';
import type { UUID } from '../../shared/types.js';

export default class TournamentService {
	private static async createTournamentMatches(tournament: UUID, participants: UUID[]) {
	}

	static async createTournament(creator: UUID, participants: UUID[]): Promise<tournamentSchemas.Tournament | null> {
		const settings = await SettingsRepository.getSettingsByUser(creator);
		if (!settings)
			throw new SettingsNotFoundError(creator);

		const tournament = await TournamentRepository.createTournament(
			tournamentSchemas.CreateDbTournamentSchema.parse({
				size:			participants.length,
				current_round:	1,
				settings:		settings.id,
				status:			(participants.length == 2 ? TournamentStatus.InProgress : TournamentStatus.Pending),
			})
		)
		if (!tournament)
			throw new DatabaseError("Error while creating tournament");

		const all_participants = await Promise.all(
  			participants.map(p =>
				ParticipantRepository.createParticipant(
					participantSchemas.CreateParticipantSchema.parse({
						tournament_id: tournament.id,
						user_id: p,
						status: (participants.length == 2 ? ParticipantStatus.Accepted : ParticipantStatus.Pending),
					})
				)
			)
		);
		if (all_participants.includes(null))
			throw new DatabaseError("Error while creating tournament");

		TournamentService.createTournamentMatches(tournament.id, participants);
		return null;
	}
}
