import {
	EMPTY_UUID,
	ERROR_USER_NOT_CONNECTED,
	PAUSE_MESSAGE,
	START_MESSAGE,
} from '../../shared/constants.js';
import { MatchStatus } from '../../shared/enums.js';
import {
	MatchNotFoundError,
	MatchNotReadyError,
	ParticipantNotFoundError,
	UserNotConnectedError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import { Match as MatchFromSchema } from '../../shared/schemas/match.js';
import { Message, UUID } from '../../shared/types.js';
import { connections } from '../connection_manager/connection_manager.js';
import { Match } from '../game/match.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';

export class GameService {
	private static instance: GameService;
	private matches = new Map<UUID, Match>();

	private constructor() {}

	static getInstance(): GameService {
		if (!this.instance) {
			this.instance = new GameService();
		}
		return this.instance;
	}

	private readonly protocolFunctionMap = {
		i: this.handleInitiate,
		s: this.handleStart,
		q: this.handleQuit,
		p: this.handlePause,
		m: this.handleMove,
		a: this.handleAccept,
		d: this.handleDecline,
	} as const;

	handleMessage(connectionId: UUID, message: string) {
		const json = JSON.parse(message);
		const handler =
			this.protocolFunctionMap[
				json.type as keyof typeof this.protocolFunctionMap
			];
		if (handler) {
			try {
				handler.call(this, connectionId, json);
			} catch (error) {
				// destroy game?
			}
		} else {
			logger.warn(`No handler for message type: ${json.type}`);
		}
	}

	private async handleInitiate(connectionId: UUID, message: Message) {
		const match_id = message.d as UUID;
		const match = await MatchRepository.getMatch(match_id);
		if (!match) throw new MatchNotFoundError(match_id);
		const matchObject = await this.createMatchObject(match);
		matchObject.users.forEach(p => {
			this.matches.set(p, matchObject);
		});
		this.sendInvitation(
			this.getUsersFromConnectionId(connectionId, matchObject.users)
				.others
		);
	}

	private async handleStart(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.sendMessage(START_MESSAGE, match.users);
		match.status = MatchStatus.InProgress;
	}

	private async handlePause(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.sendMessage(PAUSE_MESSAGE, match.users);
		match.status = MatchStatus.Paused;
	}

	private async handleMove(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		const users = this.getUsersFromConnectionId(connectionId, match.users);
		const i = match.users.findIndex(p => p === users.current);
		match.paddlePos[i] = Number(message.d);
		this.sendMove(message, users.others);
	}

	private async handleAccept(connectionId: UUID, message: Message) {
		// handle tournament and match
	}

	private async handleDecline(connectionId: UUID, message: Message) {
		// handle tournament and match
	}

	private async handleQuit(connectionId: UUID, message: Message) {
		// only match, leave tournament via api
	}

	private async createMatchObject(match: MatchFromSchema): Promise<Match> {
		if (!match.participant_1_id || !match.participant_2_id)
			throw new MatchNotReadyError(match.id);
		const participant1 = await ParticipantRepository.getParticipant(
			match.participant_1_id
		);
		const participant2 = await ParticipantRepository.getParticipant(
			match.participant_2_id
		);
		if (!participant1 || !participant2)
			throw new ParticipantNotFoundError(
				participant1 ? match.participant_2_id : match.participant_1_id,
				'participant_id'
			);
		const match_object = new Match(match.id, [
			participant1.user_id,
			participant2.user_id,
		]);
		return match_object;
	}

	private sendInvitation(userIds: UUID[]) {}
	private sendMessage(message: Message, user_ids: UUID[]) {}
	private sendMove(message: Message, user_ids: UUID[]) {}
	private sendAccept(message: Message, user_ids: UUID[]) {}
	private sendDecline(message: Message, user_ids: UUID[]) {}

	private getUsersFromConnectionId(
		connectionId: UUID,
		participants: UUID[]
	): { current: UUID; others: UUID[] } {
		var current: UUID = EMPTY_UUID;
		const others: UUID[] = [];

		for (const p of participants) {
			const socket = connections.get(p);
			if (!socket)
				throw new UserNotConnectedError(ERROR_USER_NOT_CONNECTED);
			if (socket.socketId == connectionId) current = p;
			else others.push(p);
		}
		return { current: current, others: others };
	}
}
