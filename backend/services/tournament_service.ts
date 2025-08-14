import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import { CreateMatchSchema, Match } from '../../shared/schemas/match.js';
import {
	CreateParticipantSchema,
	Participant,
} from '../../shared/schemas/participant.js';
import {
	Tournament,
	CreateDbTournamentSchema,
} from '../../shared/schemas/tournament.js';
import { ParticipantStatus } from '../../shared/enums.js';
import { TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	SettingsNotFoundError,
} from '../../shared/exceptions.js';
import { randomInt } from '../../shared/utils.js';
import type { UUID } from '../../shared/types.js';

export default class TournamentService {
	private static async createParticipants(
		tournament: UUID,
		participants: UUID[]
	) {
		return await Promise.all(
			participants.map(p =>
				ParticipantRepository.createParticipant(
					CreateParticipantSchema.parse({
						tournament_id: tournament,
						user_id: p,
						status:
							participants.length == 2
								? ParticipantStatus.Accepted
								: ParticipantStatus.Pending,
					})
				)
			)
		);
	}

	private static randomParticipant(participants: Participant[]) {
		const index = randomInt(0, participants.length - 1);
		const participant = participants[index];
		participants.splice(index, 1);
		return participant;
	}

	private static async createMatchesForRound(
		tournament: UUID,
		participants: Participant[],
		round: number
	): Promise<Array<Match | null>> {
		const result: Array<Match | null> = [];
		const participants_copy = Object.assign([], participants);
		var match: Match | null;
		while (participants_copy.length > 0) {
			match = await MatchRepository.createMatch(
				CreateMatchSchema.parse({
					tournament_id: tournament,
					tournament_round: round,
					participant_1_id:
						round == 1
							? this.randomParticipant(participants_copy).id
							: null,
					participant_2_id:
						round == 1
							? this.randomParticipant(participants_copy).id
							: null,
				})
			);
			result.push(match);
		}
		return result;
	}

	private static async createTournamentMatches(
		tournament: UUID,
		participants: Participant[]
	) {
		const result: Array<Match | null> = [];
		var matches: Array<Match | null> = await this.createMatchesForRound(
			tournament,
			participants,
			1
		);
		result.concat(matches);
		if (participants.length > 2) {
			matches = await this.createMatchesForRound(
				tournament,
				participants,
				2
			);
			result.concat(matches);
		}
		return matches;
	}

	static async createTournament(
		creator: UUID,
		participants: UUID[]
	): Promise<Tournament | null> {
		const settings = await SettingsRepository.getSettingsByUser(creator);
		if (!settings) throw new SettingsNotFoundError(creator);

		const tournament = await TournamentRepository.createTournament(
			CreateDbTournamentSchema.parse({
				size: participants.length,
				current_round: 1,
				settings: settings.id,
				status:
					participants.length == 2
						? TournamentStatus.InProgress
						: TournamentStatus.Pending,
			})
		);
		if (!tournament)
			throw new DatabaseError('Error while creating tournament');

		const all_participants = await this.createParticipants(
			tournament.id,
			participants
		);
		if (
			all_participants.length != tournament.size ||
			all_participants.includes(null)
		)
			throw new DatabaseError('Error while creating tournament');

		const matches = await this.createTournamentMatches(
			tournament.id,
			// @ts-expect-error - we already check for null
			all_participants
		);
		if (matches.includes(null))
			throw new DatabaseError('Error while creating tournament');
		return tournament;
	}
}
