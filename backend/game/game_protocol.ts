import {
	EMPTY_PLAYER,
	EMPTY_UUID,
	ERROR_PLAYER_NOT_FOUND,
	ERROR_USER_CONNECTION_NOT_FOUND,
	INVITATION_MESSAGE,
	MATCH_START_MESSAGE,
	MESSAGE_ACCEPT,
	MESSAGE_DECLINE,
	MESSAGE_GAME_STATE,
	MESSAGE_INITIATE_MATCH,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	TOURNAMENT_START_MESSAGE,
} from '../../shared/constants.js';
import {
	MatchStatus,
	ParticipantStatus,
	TournamentStatus,
} from '../../shared/enums.js';
import {
	ConnectionError,
	MatchNotFoundError,
	MatchNotReadyError,
	ParticipantNotFoundError,
	ProtocolError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	Match as MatchFromSchema,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import {
	Participant,
	UpdateParticipantSchema,
} from '../../shared/schemas/participant.js';
import {
	Tournament,
	UpdateTournamentSchema,
} from '../../shared/schemas/tournament.js';
import { Message } from '../../shared/schemas/message.js'
import { UUID } from '../../shared/types.js';
import {
	connections,
	userIdToConnectionMap,
} from '../connection_manager/connection_manager.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import MatchService from '../services/match_service.js';
import { GameSocket, Player } from '../types/interfaces.js';
import { Match } from './match.js';

export class GameService {
	private static instance: GameService;
	private matches = new Map<UUID, Match>(); // Links connectionId to match

	private constructor() { }

	private readonly protocolFunctionMap = {
		[MESSAGE_INITIATE_MATCH]: this.handleInitiate,
		[MESSAGE_ACCEPT]: this.handleAccept,
		[MESSAGE_DECLINE]: this.handleDecline,
		[MESSAGE_MOVE]: this.handleMove,
		[MESSAGE_GAME_STATE]: this.handleGameState,
		[MESSAGE_POINT]: this.handlePoint,
		[MESSAGE_PAUSE]: this.handlePause,
		[MESSAGE_QUIT]: this.handleQuit,
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
				const match = this.matches.get(connectionId);
				if (!match) throw new MatchNotFoundError();
				this.endMatch(match);
			}
		} else {
			logger.warn(`No handler for message type: ${json.type}`);
		}
	}

	private handleInitiate(connectionId: UUID, message: Message) {
		logger.debug('websocket: game initiate message received.');
		const socket = this.getSocket(connectionId);
		const match_id = message.d as UUID;
		const match = MatchRepository.getMatch(match_id);
		if (!match) throw new MatchNotFoundError(match_id);

		const matchObject = this.createMatchObject(match, socket.userId);
		matchObject.players.forEach(p => {
			this.matches.set(
				this.getSocketByUserId(p.userId).socketId,
				matchObject
			);
		});
		this.sendMatchMessage(
			INVITATION_MESSAGE,
			this.getPlayersFromConnectionId(connectionId, matchObject.players)
				.others
		);
	}

	private handleAccept(connectionId: UUID, message: Message) {
		logger.debug('websocket: accept message received.');
		const match = this.matches.get(connectionId);
		if (match) this.acceptMatch(connectionId, message, match);
		else this.acceptTournament(connectionId, message);
	}

	private handleDecline(connectionId: UUID, message: Message) {
		logger.debug('websocket: decline message received.');
		const match = this.matches.get(connectionId);
		if (match) this.declineMatch(connectionId, message, match);
		else this.declineTournament(connectionId, message);
	}

	private handleMove(connectionId: UUID, message: Message) {
		logger.debug('websocket: move message received.');
		const match = this.getMatchObject(connectionId);
		const players = this.getPlayersFromConnectionId(
			connectionId,
			match.players
		);
		players.current.paddlePos = Number(message.d);
		this.sendMatchMessage(message, players.others);
	}

	private handleGameState(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.sendMatchMessage(message, match.players);
	}

	private handlePoint(connectionId: UUID, message: Message) {
		// TODO: check if message comes from game creator?
		logger.debug('websocket: point scored message received.');
		const userId = message.d as UUID;
		const match = this.getMatchObject(connectionId);
		const player = match.players.find(p => p.userId === userId);
		if (!player)
			throw new ProtocolError(ERROR_PLAYER_NOT_FOUND + ': ' + userId);
		player.score++;
		const matchFinished = MatchService.processPointAndCheckMatchFinished(
			match.matchId,
			userId
		);
		this.sendMatchMessage(message, match.players);
	}

	private handleQuit(connectionId: UUID, message: Message) {
		logger.debug('websocket: quit message received.');
		const match = this.getMatchObject(connectionId);
		this.endMatch(match);
	}

	private handlePause(connectionId: UUID, message: Message) {
		logger.debug('websocket: pause message received.');
		const match = this.getMatchObject(connectionId);
		this.sendMatchMessage(message, match.players);
		this.updateMatchStatus(match.matchId, MatchStatus.Paused);
	}

	private createMatchObject(match: MatchFromSchema, creator: UUID): Match {
		if (!match.participant_1_id || !match.participant_2_id)
			throw new MatchNotReadyError(match.id);
		const participant1 = ParticipantRepository.getParticipant(
			match.participant_1_id
		);
		const participant2 = ParticipantRepository.getParticipant(
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
		const players = this.getPlayersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'a', d: players.current.userId };
		this.sendMatchMessage(outgoing_message, match.players);
		match.accept(players.current.userId);
		const dbMatch = this.getDbMatch(match.matchId);
		if (dbMatch.status == MatchStatus.Pending && match.allAccepted()) {
			this.startMatch(match);
		}
	}

	private declineMatch(connectionId: UUID, message: Message, match: Match) {
		const players = this.getPlayersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'd', d: players.current.userId };
		this.sendMatchMessage(outgoing_message, match.players);
		this.endMatch(match);
	}

	private acceptTournament(connectionId: UUID, message: Message) {
		const socket = this.getSocket(connectionId);
		const tournament = this.getTournament(socket.userId);
		const participant = this.getParticipant(tournament.id, socket.userId);
		participant.status = ParticipantStatus.Accepted;
		const update = UpdateParticipantSchema.strip().parse(participant);
		ParticipantRepository.updateParticipant(participant.id, update);
		const participants = ParticipantRepository.getTournamentParticipants(
			tournament.id
		);
		if (participants.every(p => p.status === ParticipantStatus.Accepted)) {
			tournament.status = TournamentStatus.InProgress;
			const tournamentUpdate =
				UpdateTournamentSchema.strip().parse(tournament);
			TournamentRepository.updateTournament(
				tournament.id,
				tournamentUpdate
			);
			this.sendTournamentMessage(TOURNAMENT_START_MESSAGE, participants);
		}
	}

	private declineTournament(connectionId: UUID, message: Message) {
		const socket = this.getSocket(connectionId);
		const tournament = this.getTournament(socket.userId);
		const participants = ParticipantRepository.getTournamentParticipants(
			tournament.id
		);
		message.d = socket.userId;
		this.sendTournamentMessage(message, participants);
	} // TODO: delete tournament?

	private startMatch(match: Match) {
		this.updateMatchStatus(match.matchId, MatchStatus.InProgress);
		this.sendMatchMessage(MATCH_START_MESSAGE, match.players);
	}

	private endMatch(match: Match) {
		this.updateMatchStatus(match.matchId, MatchStatus.Cancelled);
		const outgoing_message: Message = { t: 'q' };
		this.sendMatchMessage(outgoing_message, match.players);
		for (const [k, m] of this.matches) {
			if (m.matchId === match.matchId) this.matches.delete(k);
		}
	}

	private sendMatchMessage(message: Message, players: Player[]) {
		players.forEach(p => {
			userIdToConnectionMap.get(p.userId)?.send(JSON.stringify(message));
		});
	}

	private sendTournamentMessage(
		message: Message,
		participants: Participant[]
	) {
		participants.forEach(p => {
			userIdToConnectionMap.get(p.user_id)?.send(JSON.stringify(message));
		});
	}

	private getPlayersFromConnectionId(
		connectionId: UUID,
		players: Player[]
	): { current: Player; others: Player[] } {
		var current: Player = EMPTY_PLAYER;
		const others: Player[] = [];

		for (const p of players) {
			const socket = userIdToConnectionMap.get(p.userId);
			if (!socket)
				throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
			if (socket.socketId == connectionId) current = p;
			else others.push(p);
		}
		if (current.userId == EMPTY_UUID)
			throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return { current: current, others: others };
	}

	private getSocket(connectionId: UUID): GameSocket {
		const socket = connections.get(connectionId);
		if (!socket) throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return socket;
	}

	private getSocketByUserId(userId: UUID): GameSocket {
		const socket = userIdToConnectionMap.get(userId);
		if (!socket) throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return socket;
	}

	private getTournament(userId: UUID): Tournament {
		const tournament = TournamentRepository.getPendingTournament(userId);
		if (!tournament)
			throw new ProtocolError('No pending tournament to accept');
		return tournament;
	}

	private getParticipant(tournamentId: UUID, userId: UUID): Participant {
		const participant = ParticipantRepository.getParticipant(
			tournamentId,
			userId
		);
		if (!participant)
			throw new ProtocolError('No pending tournament to accept');
		return participant;
	}

	private getMatchObject(connectionId: UUID): Match {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		return match;
	}

	private getDbMatch(matchId: UUID): MatchFromSchema {
		const match = MatchRepository.getMatch(matchId);
		if (!match) throw new MatchNotFoundError(matchId);
		return match;
	}

	private updateMatchStatus(matchId: UUID, status: MatchStatus) {
		const dbMatch = this.getDbMatch(matchId);
		dbMatch.status = MatchStatus.InProgress;
		const matchUpdate = UpdateMatchSchema.strip().parse(dbMatch);
		MatchRepository.updateMatch(matchId, matchUpdate);
	}
}
