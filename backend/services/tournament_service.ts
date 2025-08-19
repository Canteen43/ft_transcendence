'use strict';

import { ParticipantStatus, TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	SettingsNotFoundError,
	TournamentNotFoundError,
} from '../../shared/exceptions.js';
import {
	CreateMatch,
	CreateMatchSchema,
	Match,
} from '../../shared/schemas/match.js';
import {
	CreateParticipant,
	CreateParticipantSchema,
} from '../../shared/schemas/participant.js';
import {
	CreateTournamentSchema,
	FullTournament,
	FullTournamentSchema,
	Tournament,
} from '../../shared/schemas/tournament.js';
import type { UUID } from '../../shared/types.js';
import { randomInt } from '../../shared/utils.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';

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

	static async finishMatch(match: Match) {
		const tournament = await TournamentRepository.getTournament(
			match.tournament_id
		);
		if (!tournament) throw new TournamentNotFoundError(match.tournament_id);

		if (match.tournament_round == this.numberOfRounds(tournament.size)) {
			const unfinished =
				await MatchRepository.getNumberOfUnfinishedMatches(
					match.tournament_id,
					match.tournament_round
				);
			if (!unfinished)
				this.startNewRound(
					match.tournament_id,
					match.tournament_round + 1
				);
		}
	}

	private static async startNewRound(tournament_id: UUID, round: number) {
		var participants = await MatchRepository.getWinners(
			tournament_id,
			round
		);
		var matches = await MatchRepository.getTournamentMatches(
			tournament_id,
			round
		);
		for (var i = 0; i < participants.length / 2; i++) {
			MatchRepository.updateParticipants(
				matches[i].id,
				this.randomParticipant(participants),
				this.randomParticipant(participants)
			);
		}
	}

	private static numberOfRounds(size: number): number {
		var result = 1;
		while (size > 2) {
			result += size / 2;
			size /= 2;
		}
		return result;
	}
}
