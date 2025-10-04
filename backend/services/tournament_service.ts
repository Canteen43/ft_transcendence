import { DEFAULT_MAX_SCORE, EMPTY_UUID } from '../../shared/constants.js';
import { MatchStatus, TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	TournamentNotFoundError,
	UserAlreadyQueuedError,
	UserNotQueuedError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	CreateMatch,
	CreateMatchSchema,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import {
	CreateParticipant,
	CreateParticipantSchema,
} from '../../shared/schemas/participant.js';
import { CreateSettings } from '../../shared/schemas/settings.js';
import {
	CreateTournament,
	FullTournament,
	FullTournamentSchema,
	Tournament,
	UpdateTournamentSchema,
} from '../../shared/schemas/tournament.js';
import type { UUID } from '../../shared/types.js';
import { arrayMin, randomInt } from '../../shared/utils.js';
import { GameProtocol } from '../game/game_protocol.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import { QueuedUser } from '../types/interfaces.js';
import { LockService, LockType } from './lock_service.js';

export default class TournamentService {
	private static tournamentQueues: Map<number, Set<QueuedUser>> = new Map();

	static async joinQueue(
		size: number,
		userId: UUID,
		alias: string
	): Promise<void> {
		return await LockService.withLock(LockType.Queue, async () =>
			this.joinQueueWithLock(size, userId, alias)
		);
	}

	private static joinQueueWithLock(
		size: number,
		userId: UUID,
		alias: string
	) {
		let queue = this.tournamentQueues.get(size);
		if (!queue) {
			queue = new Set<QueuedUser>();
			this.tournamentQueues.set(size, queue);
		}
		if (this.findInQueue(queue, userId))
			throw new UserAlreadyQueuedError(userId);
		queue.add({ userId, alias });
	}

	static leaveQueue(userId: UUID) {
		logger.debug('Leave tournament request received');
		LockService.withLock(LockType.Queue, async () =>
			this.leaveQueueWithLock(userId)
		);
	}

	private static leaveQueueWithLock(userId: UUID) {
		for (const [size, queue] of this.tournamentQueues) {
			const userToRemove = this.findInQueue(queue, userId);
			if (userToRemove) queue.delete(userToRemove);
		}
	}

	static async getQueue(size: number): Promise<Set<QueuedUser>> {
		const result = await LockService.withLock(LockType.Queue, async () =>
			this.tournamentQueues.get(size)
		);
		return this.tournamentQueues.get(size) || new Set();
	}

	static getFullTournament(id: UUID): FullTournament | null {
		const tournament = TournamentRepository.getTournament(id);
		if (!tournament) throw new TournamentNotFoundError('user id', id);

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

	static createTournamentFromQueue(creator: UUID, users: UUID[]): Tournament {
		const tournamentUsers = this.validateAndRemoveFromQueue(
			users.length,
			users
		);
		return this.createTournament(creator, users, tournamentUsers);
	}

	static createTournamentForReplay(creator: UUID, users: UUID[]): Tournament {
		for (const u of users)
			if (this.findInQueue(this.tournamentQueues.get(0), u))
				throw new UserAlreadyQueuedError(u);
		const queuedUsers = this.createQueuedUsersForReplay(users);
		return this.createTournament(creator, users, queuedUsers);
	}

	private static createTournament(
		creator: UUID,
		users: UUID[],
		tournamentUsers: QueuedUser[]
	): Tournament {
		const createSettings: CreateSettings = { max_score: DEFAULT_MAX_SCORE };

		const createTournament: CreateTournament = {
			settings_id: EMPTY_UUID,
			size: users.length,
			status: TournamentStatus.InProgress,
		};

		const createParticipants = this.createParticipants(tournamentUsers);
		const createMatches = this.createTournamentMatches(users);
		const { tournament, participants } =
			TournamentRepository.createFullTournament(
				createSettings,
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

	static cancelTournament(tournament_id: UUID) {
		const tournament = TournamentRepository.getTournament(tournament_id);
		if (!tournament)
			throw new TournamentNotFoundError('tournament id', tournament_id);
		tournament.status = TournamentStatus.Cancelled;
		const update = UpdateTournamentSchema.strip().parse(tournament);

		const matches = MatchRepository.getTournamentMatches(tournament_id);
		const matchUpdates: { id: UUID; update: any }[] = [];
		for (const match of matches) {
			match.status = MatchStatus.Cancelled;
			const update = UpdateMatchSchema.strip().parse(match);
			matchUpdates.push({ id: match.id, update });
		}

		TournamentRepository.cancelTournament(
			tournament_id,
			update,
			matchUpdates
		);
	}

	static getNumberOfRounds(tournament_id: UUID): number {
		const tournament = TournamentRepository.getTournament(tournament_id);
		if (!tournament)
			throw new TournamentNotFoundError('tournament id', tournament_id);

		let result = 1;
		while (tournament.size > 2) {
			result += 1;
			tournament.size /= 2;
		}
		return result;
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
	): QueuedUser[] {
		const queue = this.tournamentQueues.get(size);
		if (!queue) throw new UserNotQueuedError(users[0]);

		const tournamentUsers = new Array<QueuedUser>();
		for (const user of users) {
			const toRemove = this.findInQueue(queue, user);
			if (!toRemove) throw new UserNotQueuedError(user);
			tournamentUsers.push(toRemove);
		}
		for (const user of tournamentUsers) {
			queue.delete(user);
		}
		return tournamentUsers;
	}

	private static createQueuedUsersForReplay(users: UUID[]): QueuedUser[] {
		if (!users.length)
			throw new TournamentNotFoundError('non existing user', '');
		const tournaments = TournamentRepository.getTournamentsForUser(
			users[0]
		);
		if (!tournaments.length)
			throw new TournamentNotFoundError('user id', users[0]);
		const tournament = arrayMin(tournaments, t => t.created_at.getTime());
		const participants = ParticipantRepository.getTournamentParticipants(
			tournament.id
		);
		const queuedUsers: QueuedUser[] = users.map(u => ({
			userId: u,
			alias: participants.find(p => p.user_id == u)?.alias ?? null,
		}));
		return queuedUsers;
	}

	private static createParticipants(
		users: QueuedUser[]
	): CreateParticipant[] {
		return users.map(u =>
			CreateParticipantSchema.parse({
				user_id: u.userId,
				alias: u.alias,
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

	private static findInQueue(
		queue: Set<QueuedUser> | undefined,
		userId: UUID
	): QueuedUser | undefined {
		if (!queue) return undefined;
		return Array.from(queue).find(user => user.userId === userId);
	}
}
