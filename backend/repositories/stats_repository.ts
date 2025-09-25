import { MatchStatus } from '../../shared/enums.js';
import { Ranking, RankingSchema } from '../../shared/schemas/statistics.js';
import * as db from '../utils/db.js';
import MatchRepository from './match_repository.js';
import ParticipantRepository from './participant_repository.js';
import UserRepository from './user_repository.js';

export class StatsRepository {
	static getRanking(): Ranking {
		const rows = db.queryAll(`
			WITH matches_p1 AS (
				SELECT
					participants.user_id,
					SUM(
						CASE
							WHEN participant_1_score > participant_2_score THEN 1
							ELSE 0
						END
		 			) AS wins,
					COUNT(*) AS matches, 
					SUM(participant_1_score) AS goals_scored,
					SUM(participant_2_score) AS goals_against
				FROM ${ParticipantRepository.table} participants
				INNER JOIN ${MatchRepository.table} matches
					ON participants.id = matches.participant_1_id
					AND matches.status = ${MatchStatus.Finished}
				GROUP BY participants.user_id
			),
			matches_p2 AS (
				SELECT
					participants.user_id,
					SUM(
						CASE
							WHEN participant_2_score > participant_1_score THEN 1
							ELSE 0
						END
		 			) AS wins,
					COUNT(*) AS matches, 
					SUM(participant_2_score) AS goals_scored,
					SUM(participant_1_score) AS goals_against
				FROM ${ParticipantRepository.table} participants
				INNER JOIN ${MatchRepository.table} matches
					ON participants.id = matches.participant_2_id
					AND matches.status = ${MatchStatus.Finished}
				GROUP BY participants.user_id
			),
			pre_calc AS (
				SELECT
					users.id,
					users.login,
					users.alias,
					COALESCE(matches_p1.wins, 0) + COALESCE(matches_p2.wins, 0) AS wins,
					COALESCE(matches_p1.matches, 0) + COALESCE(matches_p2.matches, 0) AS matches,
					COALESCE(matches_p1.goals_scored, 0) + COALESCE(matches_p2.goals_scored, 0) AS goals_scored,
					COALESCE(matches_p1.goals_against, 0) + COALESCE(matches_p2.goals_against, 0) AS goals_against
				FROM ${UserRepository.table} users
				LEFT JOIN matches_p1
					ON users.id = matches_p1.user_id
				LEFT JOIN matches_p2
					ON users.id = matches_p2.user_id
			)
			SELECT
				ROW_NUMBER() OVER (
					ORDER BY
						percentage_wins DESC,
						(goals_scored - goals_against) DESC,
						goals_scored DESC,
						goals_against DESC
				) AS rank,
				id,
				login,
				alias,
				wins,
				matches - wins AS losses,
				CASE
					WHEN matches = 0 THEN 0
					ELSE 1.0 * wins / matches
				END AS percentage_wins
			FROM pre_calc
			ORDER BY
				percentage_wins DESC,
				goals_scored - goals_against DESC,
				goals_scored DESC,
				goals_against DESC;`);

		return RankingSchema.parse(rows);
	}
}
