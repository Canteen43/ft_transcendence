import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import { CreateMatch, CreateMatchSchema } from '../../shared/schemas/match.js';
import {
	CreateParticipant,
	CreateParticipantSchema,
} from '../../shared/schemas/participant.js';
import {
	Tournament,
	CreateTournamentSchema,
	FullTournament,
	FullTournamentSchema,
} from '../../shared/schemas/tournament.js';
import { ParticipantStatus } from '../../shared/enums.js';
import { TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	SettingsNotFoundError,
	TournamentNotFoundError,
} from '../../shared/exceptions.js';
import { randomInt } from '../../shared/utils.js';
import type { UUID } from '../../shared/types.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import MatchRepository from '../repositories/match_repository.js';

export default class TournamentService {
	static async getFullTournament(id: UUID): Promise<FullTournament | null> {
		const tournament = await TournamentRepository.getTournament(id);
		if (!tournament) throw new TournamentNotFoundError(id);

		const participants =
			await ParticipantRepository.getTournamentParticipants(id);
		if (participants.length == 0)
			throw new DatabaseError(
				'Failed to retrieve tournament participants'
			);
		const matches = await MatchRepository.getTournamentMatches(id);
		if (matches.length == 0)
			throw new DatabaseError('Failed to retrieve tournament matches');

		const fullTournament = {
			...tournament,
			participants,
			matches,
		};

		return FullTournamentSchema.parse(fullTournament);
	}

	static async createTournament(
		creator: UUID,
		participants: UUID[]
	): Promise<Tournament> {
		const settings = await SettingsRepository.getSettingsByUser(creator);
		if (!settings) throw new SettingsNotFoundError(creator);

		const tournament = CreateTournamentSchema.parse({
			size: participants.length,
			current_round: 1,
			settings: settings.id,
			status:
				participants.length == 2
					? TournamentStatus.InProgress
					: TournamentStatus.Pending,
		});

		const all_participants = this.createParticipants(participants);
		const matches = this.createTournamentMatches(participants);

		return await TournamentRepository.createFullTournament(
			tournament,
			all_participants,
			matches
		);
	}

	private static createParticipants(
		participants: UUID[]
	): CreateParticipant[] {
		return participants.map(p =>
			CreateParticipantSchema.parse({
				user_id: p,
				status:
					participants.length == 2
						? ParticipantStatus.Accepted
						: ParticipantStatus.Pending,
			})
		);
	}

	private static randomParticipant(participants: UUID[]) {
		const index = randomInt(0, participants.length - 1);
		const participant = participants[index];
		participants.splice(index, 1);
		return participant;
	}

	private static createMatchesForRound(
		participants: UUID[],
		round: number
	): CreateMatch[] {
		const result: CreateMatch[] = [];
		const participants_copy = [...participants];
		const n = participants.length / 2 ** (round - 1);
		for (var i = 0; i < n; i += 2) {
			const match = CreateMatchSchema.parse({
				tournament_round: round,
				participant_1_id:
					round == 1
						? this.randomParticipant(participants_copy)
						: null,
				participant_2_id:
					round == 1
						? this.randomParticipant(participants_copy)
						: null,
			});
			result.push(match);
		}
		return result;
	}

	private static createTournamentMatches(
		participants: UUID[]
	): CreateMatch[] {
		var result: CreateMatch[] = this.createMatchesForRound(participants, 1);
		if (participants.length > 2) {
			var matches = this.createMatchesForRound(participants, 2);
			result.push(...matches);
		}
		return result;
	}
}
