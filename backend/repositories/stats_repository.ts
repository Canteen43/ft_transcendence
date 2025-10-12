import { MAX_RANKING_ITEMS } from '../../shared/constants.js';
import { MatchStatus } from '../../shared/enums.js';
import {
	PercentageWinsHistorySchema,
	Ranking,
	RankingItem,
	RankingSchema,
	TournamentStats,
	TournamentStatsSchema,
} from '../../shared/schemas/stats.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import MatchRepository from './match_repository.js';
import ParticipantRepository from './participant_repository.js';
import UserRepository from './user_repository.js';

export class StatsRepository {
	static getRanking(): Ranking {
		return this.getRankingItems(10);
	}

	static getUserRankingItem(userId: UUID): RankingItem | null {
		const rows = this.getRankingItems(1, userId);
		if (!rows.length) return null;
		return rows[0];
	}

	static getPercentageWinsHistory(userId: UUID) {
		const rows = db.queryAll(
			`
			WITH
			matches AS (
				SELECT  created_at AS timestamp,
						CASE
							WHEN participant_1_score > participant_2_score THEN 1
							ELSE 0
						END AS won,
						1 AS total
				FROM tournament_match match
				INNER JOIN tournament
					ON tournament.id = match.tournament_id
				INNER JOIN tournament_participant participant
					ON participant.id = match.participant_1_id
				WHERE participant.user_id = ?
				AND   match.status = '${MatchStatus.Finished}'

				UNION ALL

				SELECT  created_at AS timestamp,
						CASE
							WHEN participant_2_score > participant_1_score THEN 1
							ELSE 0
						END AS won,
						1 AS total
				FROM tournament_match match
				INNER JOIN tournament
					ON tournament.id = match.tournament_id
				INNER JOIN tournament_participant participant
					ON participant.id = match.participant_2_id
				WHERE participant.user_id = ?
				AND   match.status = '${MatchStatus.Finished}'
			)
			SELECT 
				ROW_NUMBER() OVER (ORDER BY timestamp) AS nr,
				MAX(timestamp) OVER (
					ORDER BY timestamp
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS timestamp,
				COUNT(*) OVER (
					ORDER BY timestamp
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS total_matches,
				1.0 * SUM(won) OVER (
					ORDER BY timestamp
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) /
				SUM(total) OVER (
					ORDER BY timestamp
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS percentage_wins
			FROM matches
			ORDER BY nr DESC
			LIMIT 100;`,
			[userId, userId]
		);

		return PercentageWinsHistorySchema.parse(rows);
	}

	private static getRankingItems(minMatches?: number, userId?: UUID) {
		let query = `
		WITH matches_p1 AS (
			SELECT
				participants.user_id,
				SUM(
					CASE
						WHEN participant_1_score > participant_2_score THEN 1
						ELSE 0
					END
				) AS wins,
				COUNT(*) AS played, 
				SUM(participant_1_score) AS goals_scored,
				SUM(participant_2_score) AS goals_against
			FROM ${ParticipantRepository.table} participants
			INNER JOIN ${MatchRepository.table} matches
				ON participants.id = matches.participant_1_id
				AND matches.status = '${MatchStatus.Finished}'
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
				COUNT(*) AS played, 
				SUM(participant_2_score) AS goals_scored,
				SUM(participant_1_score) AS goals_against
			FROM ${ParticipantRepository.table} participants
			INNER JOIN ${MatchRepository.table} matches
				ON participants.id = matches.participant_2_id
				AND matches.status = '${MatchStatus.Finished}'
			GROUP BY participants.user_id
		),
		pre_calc AS (
			SELECT
				users.id,
				users.login,
				users.alias,
				COALESCE(matches_p1.wins, 0) + COALESCE(matches_p2.wins, 0) AS wins,
				COALESCE(matches_p1.played, 0) + COALESCE(matches_p2.played, 0) AS played,
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
					1.0 * wins / NULLIF(played, 0) DESC,
					(goals_scored - goals_against) DESC,
					goals_scored DESC,
					goals_against ASC
			) AS rank,
			id AS user_id,
			login,
			alias,
			played,
			wins,
			played - wins AS losses,
			goals_scored,
			goals_against,
			1.0 * wins / NULLIF(played, 0) AS percentage_wins
		FROM pre_calc`;

		const query_order = `
		ORDER BY rank ASC
		LIMIT ?;`;

		let query_filter = `
			WHERE 1 = 1`;
		let params: any[] = [];
		if (minMatches) {
			query_filter += `
				AND played >= ?`;
			params.push(minMatches);
		}
		if (userId) {
			query_filter += `
				AND id = ?`;
			params.push(userId);
		}
		params.push(MAX_RANKING_ITEMS);

		const rows = db.queryAll(query + query_filter + query_order, params);
		return RankingSchema.parse(rows);
	}

	static getTournamentStats(userId: UUID): TournamentStats | null {
		const rows = db.queryAll(
			`
			WITH final AS (
				SELECT MAX(tournament_round) AS round
				FROM tournament_match
			),
			pre_calc AS (
				SELECT  participant.user_id,
						1 AS played,
						CASE
							WHEN match.participant_1_id = participant.id OR match.participant_2_id = participant.id
							THEN 1
							ELSE 0
						END AS final,
						CASE
							WHEN (match.participant_1_id = participant.id AND participant_1_score > participant_2_score)
								OR (match.participant_2_id = participant.id AND participant_2_score > participant_1_score)
							THEN 1
							ELSE 0
						END AS won
				FROM tournament_participant participant
				INNER JOIN tournament tournament
					ON  tournament.id = participant.tournament_id 
					AND participant.user_id = ?
					AND tournament.status = 'finished'
					AND tournament.size > 2
				LEFT JOIN tournament_match match
					ON  tournament.id = match.tournament_id
					AND match.tournament_round = (SELECT round FROM final LIMIT 1)
			)
			SELECT  user_id,
					login,
					SUM(played)									AS played,
					SUM(final)									AS final,
					SUM(won)									AS wins,
					1.0 * SUM(won) / NULLIF(SUM(played), 0)		AS percentage_final,
					1.0 * SUM(final) / NULLIF(SUM(played), 0)	AS percentage_wins
			FROM pre_calc
			INNER JOIN user
				ON pre_calc.user_id = user.id
			GROUP BY user_id,
					login;`,
			[userId]
		);

		if (!rows.length) return null;
		return TournamentStatsSchema.parse(rows[0]);
	}
}
