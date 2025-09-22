import {
	ERROR_RETRIEVING_NEXT_ROUND,
	ERROR_RETRIEVING_WINNERS,
} from '../../shared/constants.js';
import { MatchStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	MatchNotFoundError,
	SettingsNotFoundError,
} from '../../shared/exceptions.js';
import {
	Match,
	MatchWithUserId,
	UpdateMatchSchema,
} from '../../shared/schemas/match.js';
import type { UpdateMatchArray } from '../../shared/types.js';
import { UUID } from '../../shared/types.js';
import MatchRepository from '../repositories/match_repository.js';
import ParticipantRepository from '../repositories/participant_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentService from './tournament_service.js';

export default class MatchService {
	static processPointAndCheckMatchFinished(
		matchId: UUID,
		userId: UUID
	): boolean {
		const match = MatchRepository.getMatch(matchId);

		if (!match) throw new MatchNotFoundError(matchId);
		const userId1 = ParticipantRepository.getMatchParticipantUserId(
			match.participant_1_id
		);
		if (userId === userId1) match.participant_1_score += 1;
		else match.participant_2_score += 1;

		const { updateMatches, matchFinished, tournamentFinished } =
			this.checkMatchFinished(match);

		updateMatches.push({
			id: matchId,
			updateMatch: UpdateMatchSchema.strip().parse(match),
		});

		MatchRepository.updateMatchesAfterPointScored(
			match.tournament_id,
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
		const lost = matches.filter(m => this.lostMatch(m, userId));
		const pending = matches.filter(m => m.status == MatchStatus.Pending);
		return lost.length == 0 && pending.length > 0;
	}

	private static lostMatch(m: MatchWithUserId, userId: UUID) {
		return (
			m.status == MatchStatus.Finished &&
			((m.participant_1_user_id == userId &&
				m.participant_1_score < m.participant_2_score) ||
				(m.participant_2_user_id == userId &&
					m.participant_2_score < m.participant_1_score))
		);
	}

	private static checkMatchFinished(match: Match) {
		const updateMatches: UpdateMatchArray = [];
		let tournamentFinished = false;

		const matchFinished = this.matchFinished(
			match.tournament_id,
			match.participant_1_score,
			match.participant_2_score
		);

		if (matchFinished) {
			match.status = MatchStatus.Finished;
			const [newRound, finished] = this.checkRoundFinished(
				match.tournament_id,
				match.tournament_round
			);
			updateMatches.push(...newRound);
			tournamentFinished = finished;
		}

		return { updateMatches, matchFinished, tournamentFinished };
	}

	private static checkRoundFinished(
		tournamentId: UUID,
		tournamentRound: number
	): [newRound: UpdateMatchArray, tournamentFinished: boolean] {
		var tournamentFinished = false;
		const newRound: UpdateMatchArray = [];
		const matches = MatchRepository.getTournamentMatches(
			tournamentId,
			tournamentRound
		);

		// Current match status hasn't been updated yet,
		// so unfinished == 1 means round is over
		if (matches.filter(m => m.status != MatchStatus.Finished).length == 1) {
			const rounds = TournamentService.getNumberOfRounds(tournamentId);
			if (tournamentRound == rounds) tournamentFinished = true;
			else {
				newRound.push(
					...this.startNewRound(tournamentId, tournamentRound + 1)
				);
			}
		}
		return [newRound, tournamentFinished];
	}

	private static startNewRound(
		tournamentId: UUID,
		round: number
	): UpdateMatchArray {
		var participants = MatchRepository.getWinners(tournamentId, round - 1);
		if (!participants.length)
			throw new DatabaseError(ERROR_RETRIEVING_WINNERS);

		var matches = MatchRepository.getTournamentMatches(tournamentId, round);
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

	private static matchFinished(
		tournamentId: UUID,
		score1: number,
		score2: number
	): boolean {
		const settings =
			SettingsRepository.getSettingsByTournamentId(tournamentId);
		if (!settings)
			throw new SettingsNotFoundError('tournament', tournamentId);
		if (score1 == settings.max_score || score2 == settings.max_score)
			return true;
		return false;
	}
}
