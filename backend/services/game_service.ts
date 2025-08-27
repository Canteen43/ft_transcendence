import {
	EMPTY_PLAYER,
	EMPTY_UUID,
	ERROR_USER_CONNECTION_NOT_FOUND,
	INVITATION_MESSAGE,
	MATCH_START_MESSAGE,
	MESSAGE_ACCEPT,
	MESSAGE_DECLINE,
	MESSAGE_INITIATE_MATCH,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
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
import { Message, UUID } from '../../shared/types.js';
import {
	connections,
	userIdToConnectionMap,
} from '../connection_manager/connection_manager.js';
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
		[MESSAGE_INITIATE_MATCH]: this.handleInitiate,
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

	async handleMessage(connectionId: UUID, message: string) {
		const json = JSON.parse(message);
		const handler =
			this.protocolFunctionMap[
				json.type as keyof typeof this.protocolFunctionMap
			];
		if (handler) {
			try {
				await handler.call(this, connectionId, json);
			} catch (error) {
				// TODO: destroy game?
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
			this.matches.set(
				this.getSocketByUserId(p.userId).socketId,
				matchObject
			);
		});
		this.sendMatchMessage(
			INVITATION_MESSAGE,
			this.getUsersFromConnectionId(connectionId, matchObject.players)
				.others
		);
	}

	private async handlePause(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		this.sendMatchMessage(message, match.players);
		match.status = MatchStatus.Paused;
	}

	private async handleMove(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (!match) throw new MatchNotFoundError();
		const players = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const i = match.players.findIndex(
			p => p.userId === players.current.userId
		);
		match.paddlePos[i] = Number(message.d);
		this.sendMatchMessage(message, players.others);
	}

	private async handleAccept(connectionId: UUID, message: Message) {
		const match = this.matches.get(connectionId);
		if (match) this.acceptMatch(connectionId, message, match);
		else await this.acceptTournament(connectionId, message);
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

	private async acceptMatch(
		connectionId: UUID,
		message: Message,
		match: Match
	) {
		const players = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'a', d: players.current.userId };
		this.sendMatchMessage(outgoing_message, match.players);
		match.accept(players.current.userId);
		if (match.status == MatchStatus.Pending && match.allAccepted()) {
			await this.startMatch(match);
		}
	}

	private declineMatch(connectionId: UUID, message: Message, match: Match) {
		const players = this.getUsersFromConnectionId(
			connectionId,
			match.players
		);
		const outgoing_message: Message = { t: 'd', d: players.current.userId };
		this.sendMatchMessage(outgoing_message, match.players);
		this.endMatch(match);
	}

	private async acceptTournament(connectionId: UUID, message: Message) {
		const socket = this.getSocket(connectionId);
		const tournament = await this.getTournament(socket.userId);
		const participant = await this.getParticipant(
			tournament.id,
			socket.userId
		);
		participant.status = ParticipantStatus.Accepted;
		const update = UpdateParticipantSchema.strip().parse(participant);
		await ParticipantRepository.updateParticipant(participant.id, update);
		const participants =
			await ParticipantRepository.getTournamentParticipants(
				tournament.id
			);
		if (participants.every(p => p.status === ParticipantStatus.Accepted)) {
			tournament.status = TournamentStatus.InProgress;
			const tournamentUpdate =
				UpdateTournamentSchema.strip().parse(tournament);
			await TournamentRepository.updateTournament(
				tournament.id,
				tournamentUpdate
			);
			this.sendTournamentMessage(TOURNAMENT_START_MESSAGE, participants);
		}
	}

	private declineTournament(connectionId: UUID, message: Message) {} // TODO

	private async startMatch(match: Match) {
		const dbMatch = await MatchRepository.getMatch(match.matchId);
		if (!dbMatch) throw new MatchNotFoundError(match.matchId);
		dbMatch.status = MatchStatus.InProgress;
		const matchUpdate = UpdateMatchSchema.strip().parse(dbMatch);
		MatchRepository.updateMatch(match.matchId, matchUpdate);
		match.status = MatchStatus.InProgress;
		this.sendMatchMessage(MATCH_START_MESSAGE, match.players);
	}

	private endMatch(match: Match) {
		// TODO: Update database
		const outgoing_message: Message = { t: 'q' };
		this.sendMatchMessage(outgoing_message, match.players);
		for (const [k, m] of this.matches) {
			if (m.matchId === match.matchId) this.matches.delete(k);
		}
	}

	private sendMatchMessage(message: Message, players: Player[]) {} // TODO
	private sendTournamentMessage(
		message: Message,
		participants: Participant[]
	) {} // TODO

	private getUsersFromConnectionId(
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

	private async getTournament(userId: UUID): Promise<Tournament> {
		const tournament =
			await TournamentRepository.getPendingTournament(userId);
		if (!tournament)
			throw new ProtocolError('No pending tournament to accept');
		return tournament;
	}

	private async getParticipant(
		tournamentId: UUID,
		userId: UUID
	): Promise<Participant> {
		const participant = await ParticipantRepository.getParticipant(
			tournamentId,
			userId
		);
		if (!participant)
			throw new ProtocolError('No pending tournament to accept');
		return participant;
	}
}
