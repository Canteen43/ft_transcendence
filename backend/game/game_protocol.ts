import {
	EMPTY_PLAYER,
	EMPTY_UUID,
	ERROR_MESSAGE_HANDLE,
	ERROR_PLAYER_NOT_FOUND,
	ERROR_QUIT,
	ERROR_USER_CONNECTION_NOT_FOUND,
	MATCH_START_MESSAGE,
	MESSAGE_ACCEPT,
	MESSAGE_FINISH,
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	MESSAGE_START_TOURNAMENT,
	TOURNAMENT_QUIT_MESSAGE,
} from '../../shared/constants.js';
import { MatchStatus, TournamentStatus } from '../../shared/enums.js';
import {
	ConnectionError,
	MatchNotFoundError,
	MatchNotReadyError,
	ParticipantNotFoundError,
	ProtocolError,
	SettingsNotFoundError,
	TournamentNotFoundError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	Match as MatchFromSchema,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import { Message } from '../../shared/schemas/message.js';
import { Participant } from '../../shared/schemas/participant.js';
import {
	Tournament,
	UpdateTournamentSchema,
} from '../../shared/schemas/tournament.js';
import { UUID } from '../../shared/types.js';
import {
	getConnection,
	getConnectionByUserId,
} from '../connection_manager/connection_manager.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentRepository from '../repositories/tournament_repository.js';
import MatchService from '../services/match_service.js';
import { GameSocket, Player } from '../types/interfaces.js';
import { formatError } from '../utils/utils.js';
import { Match } from './match.js';

export class GameProtocol {
	private static instance: GameProtocol;
	private matches = new Map<UUID, Match>(); // Links connectionId to match

	private constructor() {}

	private readonly protocolFunctionMap = {
		[MESSAGE_ACCEPT]: this.handleAccept,
		[MESSAGE_MOVE]: this.handleMove,
		[MESSAGE_GAME_STATE]: this.handleGameState,
		[MESSAGE_POINT]: this.handlePoint,
		[MESSAGE_PAUSE]: this.handlePause,
		[MESSAGE_QUIT]: this.handleQuit,
	} as const;

	static getInstance(): GameProtocol {
		if (!this.instance) {
			this.instance = new GameProtocol();
		}
		return this.instance;
	}

	handleMessage(connectionId: UUID, message: string) {
		logger.trace(`websocket: message received: ${message}`);
		const json = JSON.parse(message);
		const handler =
			this.protocolFunctionMap[
				json.t as keyof typeof this.protocolFunctionMap
			];
		if (handler) {
			try {
				handler.call(this, connectionId, json);
			} catch (error) {
				logger.warn(`${ERROR_MESSAGE_HANDLE}: ${formatError(error)}`);
				const match = this.matches.get(connectionId);
				if (match) {
					try {
						this.quitAll(connectionId);
					} catch (error) {
						logger.warn(`${ERROR_QUIT}: ${formatError(error)}`);
					}
				}
			}
		} else {
			logger.warn(`No handler for message type: ${json.t}`);
		}
	}

	handleClose(connectionId: UUID) {
		try {
			this.quitAll(connectionId);
		} catch (error) {
			logger.warn(`${ERROR_QUIT}: ${formatError(error)}`);
		}
	}

	sendTournamentStart(participants: Participant[], tournament_id: UUID) {
		const message: Message = {
			t: MESSAGE_START_TOURNAMENT,
			d: tournament_id,
		};
		this.sendTournamentMessage(message, participants);
	}

	initiateMatch(connectionId: UUID, matchId: UUID): Match {
		const socket = this.getSocket(connectionId);
		const match = MatchRepository.getMatch(matchId, MatchStatus.Pending);
		if (!match) throw new MatchNotFoundError(matchId);

		const matchObject = this.createMatchObject(match, socket.userId);
		matchObject.players.forEach(p => {
			this.matches.set(
				this.getSocketByUserId(p.userId).socketId,
				matchObject
			);
		});
		return matchObject;
	}

	private handleAccept(connectionId: UUID, message: Message) {
		logger.debug('websocket: accept message received.');
		let match = this.matches.get(connectionId);
		if (!match) match = this.initiateMatch(connectionId, message.d as UUID);
		const players = this.getPlayersFromConnectionId(
			connectionId,
			match.players
		);
		match.accept(players.current.userId);
		const dbMatch = this.getDbMatch(match.matchId);
		if (dbMatch.status == MatchStatus.Pending && match.allAccepted()) {
			this.startMatch(match);
		}
	}

	private handleMove(connectionId: UUID, message: Message) {
		logger.trace('websocket: move message received.');
		const match = this.getMatchObject(connectionId);
		const players = this.getPlayersFromConnectionId(
			connectionId,
			match.players
		);
		this.sendMatchMessage(message, players.others);
	}

	private handleGameState(connectionId: UUID, message: Message) {
		logger.trace(
			'websocket: game state message received:' + JSON.stringify(message)
		);
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
		if (!player) {
			logger.warn(
				`MESSAGE_POINT: Player not found for userId: ${userId}`
			);
			throw new ProtocolError(ERROR_PLAYER_NOT_FOUND + ': ' + userId);
		}
		player.score++;
		this.sendMatchMessage(message, match.players);
		const matchFinished = this.matchFinished(match);
		MatchService.processPoint(match, matchFinished);
		if (matchFinished) {
			this.deleteMatchObject(match.matchId);
			const message: Message = { t: MESSAGE_FINISH, d: match.matchId };
			this.sendTournamentMessage(
				message,
				this.getTournamentParticipants(match.matchId)
			);
		}
	}

	private matchFinished(match: Match): boolean {
		const settings = SettingsRepository.getSettingsByTournamentId(
			match.tournamentId
		);
		if (!settings)
			throw new SettingsNotFoundError('tournament', match.tournamentId);
		return match.players.some(p => p.score === settings.max_score);
	}

	private handleQuit(connectionId: UUID, message: Message) {
		logger.debug('websocket: quit message received.');
		this.quitAll(connectionId);
	}

	private handlePause(connectionId: UUID, message: Message) {
		logger.debug('websocket: pause message received.');
		const match = this.getMatchObject(connectionId);
		this.sendMatchMessage(message, match.players);
	}

	private quitAll(connectionId: UUID) {
		const match = this.matches.get(connectionId);
		if (match) this.quitMatch(match);

		const socket = getConnection(connectionId);
		if (!socket) {
			logger.warn(ERROR_USER_CONNECTION_NOT_FOUND);
			return;
		}

		const activeTournaments = TournamentRepository.getTournamentsForUser(
			socket.userId,
			TournamentStatus.InProgress
		);

		if (activeTournaments.length != 1)
			throw new TournamentNotFoundError('user id', socket.userId);

		if (
			MatchService.userStillHasMatchesToPlay(
				activeTournaments[0].id,
				socket.userId
			)
		) {
			this.quitTournament(activeTournaments[0]);
		}
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
		const match_object = new Match(match.id, match.tournament_id, [
			participant1.user_id,
			participant2.user_id,
		]);
		return match_object;
	}

	private deleteMatchObject(matchId: UUID) {
		const keysToDelete: UUID[] = [];
		for (const [k, m] of this.matches) {
			if (m.matchId === matchId) keysToDelete.push(k);
		}
		for (const key of keysToDelete) this.matches.delete(key);
	}

	private startMatch(match: Match) {
		this.updateMatchStatus(match.matchId, MatchStatus.InProgress);
		this.sendMatchMessage(MATCH_START_MESSAGE, match.players);
	}

	private quitMatch(match: Match) {
		this.updateMatchStatus(match.matchId, MatchStatus.Cancelled);
		const participants = this.getTournamentParticipants(match.matchId);
		this.sendTournamentMessage(TOURNAMENT_QUIT_MESSAGE, participants);
		this.deleteMatchObject(match.matchId);
	}

	private quitTournament(tournament: Tournament) {
		const participants = ParticipantRepository.getTournamentParticipants(
			tournament.id
		);
		this.sendTournamentMessage(TOURNAMENT_QUIT_MESSAGE, participants);
		tournament.status = TournamentStatus.Cancelled;
		const update = UpdateTournamentSchema.strip().parse(tournament);
		TournamentRepository.updateTournament(tournament.id, update);
	}

	private sendMatchMessage(message: Message, players: Player[]) {
		logger.trace(
			`sendMatchMessage: Sending ${message.t} to ${players.length} players`
		);
		players.forEach((p, index) => {
			try {
				const connection = getConnectionByUserId(p.userId);
				if (!connection) {
					logger.warn(
						`sendMatchMessage: No connection found for userId: ${p.userId}`
					);
					return;
				}
				connection.send(JSON.stringify(message));
			} catch (error) {
				logger.warn(
					`Failed to send websocket message to user id ${p.userId}: ${formatError(error)}`
				);
				if (!(error instanceof ConnectionError)) throw error;
			}
		});
	}

	private sendTournamentMessage(
		message: Message,
		participants: Participant[]
	) {
		participants.forEach(p => {
			try {
				getConnectionByUserId(p.user_id)?.send(JSON.stringify(message));
			} catch (error) {
				logger.warn(
					`Failed to send websocket message to user ${p.user_id}: ${formatError(error)}`
				);
				if (!(error instanceof ConnectionError)) throw error;
			}
		});
	}

	private getPlayersFromConnectionId(
		connectionId: UUID,
		players: Player[]
	): { current: Player; others: Player[] } {
		var current: Player = EMPTY_PLAYER;
		const others: Player[] = [];

		for (const p of players) {
			const socket = getConnectionByUserId(p.userId);
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
		const socket = getConnection(connectionId);
		if (!socket) throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return socket;
	}

	private getSocketByUserId(userId: UUID): GameSocket {
		const socket = getConnectionByUserId(userId);
		if (!socket) throw new ConnectionError(ERROR_USER_CONNECTION_NOT_FOUND);
		return socket;
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

	private getTournamentParticipants(matchId: UUID): Participant[] {
		const dbMatch = this.getDbMatch(matchId);
		const participants = ParticipantRepository.getTournamentParticipants(
			dbMatch.tournament_id
		);
		if (participants.length == 0)
			throw new TournamentNotFoundError('match id', matchId);
		return participants;
	}

	private updateMatchStatus(matchId: UUID, status: MatchStatus) {
		const dbMatch = this.getDbMatch(matchId);
		dbMatch.status = status;
		const update = UpdateMatchSchema.strip().parse(dbMatch);
		MatchRepository.updateMatch(matchId, update);
	}
}
