'use strict';

import { ParticipantStatus, TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	SettingsNotFoundError,
	TournamentNotFoundError,
	UserAlreadyQueuedError,
	UserNotQueuedError,
} from '../../shared/exceptions.js';
import { CreateMatch, CreateMatchSchema } from '../../shared/schemas/match.js';
import {
	CreateParticipant,
	CreateParticipantSchema,
} from '../../shared/schemas/participant.js';
import {
	CreateTournamentSchema,
	FullTournament,
	FullTournamentSchema,
	Tournament,
	TournamentQueue,
} from '../../shared/schemas/tournament.js';
import type { UUID } from '../../shared/types.js';
import { randomInt } from '../../shared/utils.js';
import { GameProtocol } from '../game/game_protocol.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';

export default class TournamentService {
	private static tournamentQueues: Map<number, Set<UUID>> = new Map();

	static joinQueue(size: number, userId: UUID) {
		let queue = this.tournamentQueues.get(size);
		if (!queue) {
			queue = new Set<UUID>();
			this.tournamentQueues.set(size, queue);
		}
		if (queue.has(userId)) throw new UserAlreadyQueuedError(userId);
		queue.add(userId);
	}

	static leaveQueue(size: number, userId: UUID) {
		const queue = this.tournamentQueues.get(size);
		if (!queue || !queue.has(userId)) throw new UserNotQueuedError(userId);
		queue.delete(userId);
	}

	static getQueue(size: number): TournamentQueue {
		const result = this.tournamentQueues.get(size) || new Set();
		return { queue: [...result] };
	}

	static getFullTournament(id: UUID): FullTournament | null {
		const tournament = TournamentRepository.getTournament(id);
		if (!tournament) throw new TournamentNotFoundError(id);

		const participants =
			ParticipantRepository.getTournamentParticipants(id);
		if (participants.length == 0)
			throw new DatabaseError(
				'Failed to retrieve tournament participants'
			);
		const matches = MatchRepository.getTournamentMatches(id);
		if (matches.length == 0)
			throw new DatabaseError('Failed to retrieve tournament matches');

		const fullTournament = {
			...tournament,
			participants,
			matches,
		};

		return FullTournamentSchema.parse(fullTournament);
	}

	static createTournament(creator: UUID, users: UUID[]): Tournament {
		this.validateAndRemoveFromQueue(users.length, users);
		const settings = SettingsRepository.getSettingsByUser(creator);
		if (!settings) throw new SettingsNotFoundError('user', creator);

		const createTournament = CreateTournamentSchema.parse({
			size: users.length,
			settings: settings.id,
			status: TournamentStatus.InProgress,
		});

		const createParticipants = this.createParticipants(users);
		const createMatches = this.createTournamentMatches(users);
		const { tournament, participants } =
			TournamentRepository.createFullTournament(
				createTournament,
				createParticipants,
				createMatches
			);

		GameProtocol.getInstance().sendTournamentStart(
			participants,
			tournament.id
		);

		return tournament;
	}

	static getNumberOfRounds(tournament_id: UUID): number {
		const tournament = TournamentRepository.getTournament(tournament_id);
		if (!tournament) throw new TournamentNotFoundError(tournament_id);
		return this.numberOfRounds(tournament.size);
	}

	static randomParticipant(participants: UUID[]) {
		const index = randomInt(0, participants.length - 1);
		const participant = participants[index];
		participants.splice(index, 1);
		return participant;
	}

	private static validateAndRemoveFromQueue(
		size: number,
		users: UUID[]
	): void {
		const queue = this.tournamentQueues.get(size);
		if (!queue) throw new UserNotQueuedError(users[0]);

		for (const user of users) {
			if (!queue.has(user)) throw new UserNotQueuedError(user);
		}
		for (const user of users) queue.delete(user);
	}

	private static createParticipants(users: UUID[]): CreateParticipant[] {
		return users.map(p =>
			CreateParticipantSchema.parse({
				user_id: p,
				status:
					users.length == 2
						? ParticipantStatus.Accepted
						: ParticipantStatus.Pending,
			})
		);
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

	private static numberOfRounds(size: number): number {
		var result = 1;
		while (size > 2) {
			result += size / 2;
			size /= 2;
		}
		return result;
	}
}
