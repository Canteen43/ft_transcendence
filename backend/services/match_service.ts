import {
	ERROR_RETRIEVING_NEXT_ROUND,
	ERROR_RETRIEVING_WINNERS,
} from '../../shared/constants.js';
import { MatchStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	MatchNotFoundError,
	ParticipantNotFoundError,
} from '../../shared/exceptions.js';
import {
	Match,
	MatchWithUserId,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import type { UpdateMatchArray } from '../../shared/types.js';
import { UUID } from '../../shared/types.js';
import { Match as MatchObject } from '../game/match.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import TournamentService from './tournament_service.js';

export default class MatchService {
	static processPoint(match: MatchObject, matchFinished: boolean): boolean {
		const dbMatch = MatchRepository.getMatch(match.matchId);
		if (!dbMatch) throw new MatchNotFoundError(match.matchId);

		dbMatch.participant_1_score = match.players[0].score;
		dbMatch.participant_2_score = match.players[1].score;

		let updateMatches: UpdateMatchArray = [];
		let tournamentFinished = false;
		if (matchFinished)
			tournamentFinished = this.finishMatch(
				match,
				dbMatch,
				updateMatches
			);

		updateMatches.push({
			id: match.matchId,
			updateMatch: UpdateMatchSchema.strip().parse(dbMatch),
		});

		MatchRepository.updateMatchesAfterPointScored(
			dbMatch.tournament_id,
			updateMatches,
			tournamentFinished
		);
		return matchFinished;
	}

	static userStillHasMatchesToPlay(
		tournament_id: UUID,
		userId: UUID
	): boolean {
		const matches = MatchRepository.getTournamentMatches(tournament_id);
		const lost = matches.filter(m => this.userLostMatch(m, userId));
		const pending = matches.filter(m => m.status == MatchStatus.Pending);
		return lost.length == 0 && pending.length > 0;
	}

	private static userLostMatch(m: MatchWithUserId, userId: UUID) {
		return (
			m.status == MatchStatus.Finished &&
			((m.participant_1_user_id == userId &&
				m.participant_1_score < m.participant_2_score) ||
				(m.participant_2_user_id == userId &&
					m.participant_2_score < m.participant_1_score))
		);
	}

	private static finishMatch(
		match: MatchObject,
		dbMatch: Match,
		updateMatches: UpdateMatchArray
	): boolean {
		dbMatch.status = MatchStatus.Finished;
		const [newRound, finished] = this.checkRoundFinished(
			match,
			dbMatch.tournament_round
		);
		updateMatches.push(...newRound);
		return finished;
	}

	private static checkRoundFinished(
		match: MatchObject,
		round: number
	): [newRound: UpdateMatchArray, tournamentFinished: boolean] {
		var tournamentFinished = false;
		const newRound: UpdateMatchArray = [];
		const matches = MatchRepository.getTournamentMatches(
			match.tournamentId,
			round
		);

		// Current match status hasn't been updated yet,
		// so unfinished == 1 means round is over
		if (matches.filter(m => m.status != MatchStatus.Finished).length == 1) {
			const rounds = TournamentService.getNumberOfRounds(
				match.tournamentId
			);
			if (round == rounds) tournamentFinished = true;
			else newRound.push(...this.startNewRound(match, round + 1));
		}
		return [newRound, tournamentFinished];
	}

	private static startNewRound(
		match: MatchObject,
		round: number
	): UpdateMatchArray {
		const participants = this.getWinners(match, round - 1);
		var matches = MatchRepository.getTournamentMatches(
			match.tournamentId,
			round
		);
		if (!matches.length)
			throw new DatabaseError(ERROR_RETRIEVING_NEXT_ROUND);

		const newRound: UpdateMatchArray = [];
		for (var i = 0; i < participants.length / 2; i++) {
			matches[i].participant_1_id =
				TournamentService.randomParticipant(participants);
			matches[i].participant_2_id =
				TournamentService.randomParticipant(participants);
			newRound.push({
				id: matches[i].id,
				updateMatch: UpdateMatchSchema.strip().parse(matches[i]),
			});
		}
		return newRound;
	}

	// Can not get the current winner from the db yet,
	// so we get add it from the match object instead.
	// Using a set, so in case we somehow get it from
	// the db anyway, it doesn't cause duplicates
	private static getWinners(match: MatchObject, round: number): UUID[] {
		var participants = new Set(
			MatchRepository.getWinners(match.tournamentId, round)
		);
		if (!participants.size)
			throw new DatabaseError(ERROR_RETRIEVING_WINNERS);
		const winner = match.getWinner().userId;
		const winnerParticipant = ParticipantRepository.getParticipant(
			match.tournamentId,
			match.getWinner().userId
		);
		if (!winnerParticipant)
			throw new ParticipantNotFoundError('user id', winner);
		participants.add(winnerParticipant.id);
		return [...participants];
	}
}
