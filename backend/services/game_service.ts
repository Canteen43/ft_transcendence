import {
	EMPTY_UUID,
	ERROR_USER_CONNECTION_NOT_FOUND,
	MESSAGE_ACCEPT,
	MESSAGE_DECLINE,
	MESSAGE_INITIATE,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_QUIT,
	PAUSE_MESSAGE,
	START_MESSAGE,
} from '../../shared/constants.js';
import { MatchStatus, ParticipantStatus } from '../../shared/enums.js';
import {
	ConnectionError,
	MatchNotFoundError,
	MatchNotReadyError,
	ParticipantNotFoundError,
	ProtocolError,
	TournamentNotFoundError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	Match as MatchFromSchema,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import { UpdateParticipantSchema } from '../../shared/schemas/participant.js';
import { Message, UUID } from '../../shared/types.js';
import { connections } from '../connection_manager/connection_manager.js';
import { Match } from '../game/match.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import { GameSocket, Player } from '../types/interfaces.js';

export class GameService {
	private static instance: GameService;
	private matches = new Map<UUID, Match>(); // Links connectionId to match

	private constructor() {}

	private readonly protocolFunctionMap = {
		[MESSAGE_INITIATE]: this.handleInitiate,
		[MESSAGE_QUIT]: this.handleQuit,
		[MESSAGE_PAUSE]: this.handlePause,
		[MESSAGE_MOVE]: this.handleMove,
		[MESSAGE_ACCEPT]: this.handleAccept,
		[MESSAGE_DECLINE]: this.handleDecline,
	} as const;

	static getInstance(): GameService {
		if (!this.instance) {
			this.instance = new GameService();
		}
		return this.instance;
	}

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
		const socket = this.getSocket(connectionId);
		const match_id = message.d as UUID;
		const match = await MatchRepository.getMatch(match_id);
		if (!match) throw new MatchNotFoundError(match_id);

		const matchObject = await this.createMatchObject(match, socket.userId);
		matchObject.players.forEach(p => {
			this.matches.set(p.userId, matchObject);
		});
		this.sendInvitation(
			this.getUsersFromConnectionId(connectionId, matchObject.players)
				.others
		);
	}

	private async handlePause(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.sendMessage(PAUSE_MESSAGE, match.players);
		match.status = MatchStatus.Paused;
	}

	private async handleMove(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		const users = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const i = match.players.findIndex(p => p.userId === users.current);
		match.paddlePos[i] = Number(message.d);
		this.sendMove(message, users.others);
	}

	private async handleAccept(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (match) this.acceptMatch(connectionId, message, match);
		else this.acceptTournament(connectionId, message);
	}

	private async handleDecline(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (match) this.declineMatch(connectionId, message, match);
		else this.declineTournament(connectionId, message);
	}

	private async handleQuit(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.endMatch(match);
	}

	private async createMatchObject(
		match: MatchFromSchema,
		creator: UUID
	): Promise<Match> {
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
		const match_object = new Match(
			match.id,
			[participant1.user_id, participant2.user_id],
			creator
		);
		return match_object;
	}

	private acceptMatch(connectionId: UUID, message: Message, match: Match) {
		const users = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'a', d: users.current };
		this.sendMessage(outgoing_message, match.players);
		match.accept(users.current);
		if (match.status == MatchStatus.Pending && match.allAccepted()) {
			this.startMatch(match);
		}
	}

	private declineMatch(connectionId: UUID, message: Message, match: Match) {
		const users = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'd', d: users.current };
		this.sendMessage(outgoing_message, match.players);
		this.endMatch(match);
	}

	private async acceptTournament(connectionId: UUID, message: Message) {
		const socket = this.getSocket(connectionId);
		const tournament = await TournamentRepository.getPendingTournament(
			socket.userId
		);
		if (!tournament)
			throw new ProtocolError('No pending tournament to accept');
		const participant = await ParticipantRepository.getParticipant(
			tournament.id,
			socket.userId
		);
		if (!participant)
			throw new ProtocolError('No pending tournament to accept');
		participant.status = ParticipantStatus.Accepted;
		const update = UpdateParticipantSchema.strip().parse(participant);
		ParticipantRepository.updateParticipant(participant.id, update);
		const participants =
			await ParticipantRepository.getTournamentParticipants(
				tournament.id
			);
		//if (participants.every(p => p.status === ParticipantStatus.Accepted))
		// Start tournament
	}

	private declineTournament(connectionId: UUID, message: Message) {}

	private async startMatch(match: Match) {
		const dbMatch = await MatchRepository.getMatch(match.matchId);
		if (!dbMatch) throw new MatchNotFoundError(match.matchId);
		dbMatch.status = MatchStatus.InProgress;
		const matchUpdate = UpdateMatchSchema.strip().parse(dbMatch);
		MatchRepository.updateMatch(match.matchId, matchUpdate);
		match.status = MatchStatus.InProgress;
		this.sendMessage(START_MESSAGE, match.players);
	}

	private endMatch(match: Match) {
		const outgoing_message: Message = { t: 'q' };
		this.sendMessage(outgoing_message, match.players);
		for (const [k, m] of this.matches) {
			if (m.matchId === match.matchId) this.matches.delete(k);
		}
	}

	private sendInvitation(userIds: UUID[]) {}
	private sendMessage(message: Message, players: Player[]) {}
	private sendMove(message: Message, user_ids: UUID[]) {}

	private getUsersFromConnectionId(
		connectionId: UUID,
		players: Player[]
	): { current: UUID; others: UUID[] } {
		var current: UUID = EMPTY_UUID;
		const others: UUID[] = [];

		for (const p of players) {
			const socket = connections.get(p.userId);
			if (!socket)
				throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
			if (socket.socketId == connectionId) current = p.userId;
			else others.push(p.userId);
		}
		return { current: current, others: others };
	}

	private getSocket(connectionId: UUID): GameSocket {
		const socket = connections.get(connectionId);
		if (!socket) throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return socket;
	}
}
