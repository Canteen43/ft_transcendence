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
import { Match, UpdateMatchSchema } from '../../shared/schemas/match.js';
import type { UpdateMatchArray } from '../../shared/types.js';
import { UUID } from '../../shared/types.js';
import MatchRepository from '../repositories/match_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentService from './tournament_service.js';

export default class MatchService {
	static async pointScored(match_id: UUID, participant_id: UUID) {
		const match = await MatchRepository.getMatch(match_id);
		if (!match) throw new MatchNotFoundError(match_id);

		if (participant_id === match.participant_1_id)
			match.participant_1_score += 1;
		else match.participant_2_score += 1;

		const { updateMatches, tournamentFinished } =
			await this.handleFinishedMatch(match);

		updateMatches.push({
			id: match_id,
			updateMatch: UpdateMatchSchema.strip().parse(match),
		});

		MatchRepository.updateMatchesAfterPointScored(
			match.tournament_id,
			updateMatches,
			tournamentFinished
		);
	}

	private static async handleFinishedMatch(match: Match) {
		const updateMatches: UpdateMatchArray = [];
		let tournamentFinished = false;

		const matchFinished = await this.matchFinished(
			match.tournament_id,
			match.participant_1_score,
			match.participant_2_score
		);

		if (matchFinished) {
			match.status = MatchStatus.Finished;
			const [newRound, finished] = await this.checkRoundFinished(
				match.tournament_id,
				match.tournament_round
			);
			updateMatches.push(...newRound);
			tournamentFinished = finished;
		}

		return { updateMatches, tournamentFinished };
	}

	private static async checkRoundFinished(
		tournament_id: UUID,
		tournament_round: number
	): Promise<[newRound: UpdateMatchArray, tournamentFinished: boolean]> {
		var tournamentFinished = false;
		const newRound: UpdateMatchArray = [];
		const unfinished = await MatchRepository.getNumberOfUnfinishedMatches(
			tournament_id,
			tournament_round
		);

		// Current match status hasn't been updated yet,
		// so unfinished == 1 means round is over
		if (unfinished <= 1) {
			const rounds =
				await TournamentService.getNumberOfRounds(tournament_id);
			if (tournament_round == rounds) tournamentFinished = true;
			else {
				newRound.push(
					...(await this.startNewRound(
						tournament_id,
						tournament_round + 1
					))
				);
			}
		}
		return [newRound, tournamentFinished];
	}

	private static async startNewRound(
		tournament_id: UUID,
		round: number
	): Promise<UpdateMatchArray> {
		var participants = await MatchRepository.getWinners(
			tournament_id,
			round
		);
		if (!participants.length)
			throw new DatabaseError(ERROR_RETRIEVING_WINNERS);

		var matches = await MatchRepository.getTournamentMatches(
			tournament_id,
			round
		);
		if (!participants.length)
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

	private static async matchFinished(
		tournament_id: UUID,
		score_1: number,
		score_2: number
	): Promise<boolean> {
		const settings =
			await SettingsRepository.getSettingsByTournamentId(tournament_id);
		if (!settings)
			throw new SettingsNotFoundError('tournament', tournament_id);
		if (score_1 == settings.max_score || score_2 == settings.max_score)
			return true;
		return false;
	}
}
