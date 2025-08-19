import {
	MatchNotFoundError,
	SettingsNotFoundError,
} from '../../shared/exceptions.js';
import { UUID } from '../../shared/types.js';
import MatchRepository from '../repositories/match_repository.js';
import SettingsRepository from '../repositories/settings_repository.js';
import TournamentService from './tournament_service.js';

export default class MatchService {
	async addPoint(match_id: UUID, participant_id: UUID) {
		// this function needs to collect an array of UpdateMatchSchema, plus a boolean tournamentFinished and pass it to the repository
		const match = await MatchRepository.updateScore(
			match_id,
			participant_id
		);
		if (!match) throw new MatchNotFoundError(match_id);

		const settings = await SettingsRepository.getSettingsByTournamentId(
			match.tournament_id
		);
		if (!settings)
			throw new SettingsNotFoundError('tournament', match.tournament_id);

		if (
			match.participant_1_score == settings.max_score ||
			match.participant_2_score == settings.max_score
		)
			TournamentService.finishMatch(match);
	}
}
