import z from 'zod';

export const WinsLossesSchema = z.object({
	played: z.number(),
	wins: z.number(),
	losses: z.number(),
	goals_scored: z.number(),
	goals_against: z.number(),
	percentage_wins: z.number(),
});

export const RankingSchema = z.object({
	rank: z.number(),
	data: z.array(WinsLossesSchema),
});

export const RoundStatsSchema = z.object({
	round: z.number(),
	played: z.number(),
	wins: z.number(),
	losses: z.number(),
});

export const TournamentStatsSchema = z.object({
	played: z.number(),
	wins: z.number(),
	round_stats: z.array(RoundStatsSchema),
});

export const PercentageWinsSchema = z.object({
	nr: z.number(),
	percentage_wins: z.number(),
});

export const PercentageWinsHistorySchema = z.object({
	data: z.array(PercentageWinsSchema),
});

export const MatchHistoryItemSchema = z.object({
	first_match_timestamp: z.string(),
	last_match_timestamp: z.string(),
	percentage_wins: z.number(),
});

export const MatchHistorySchema = z.object({
	data: z.array(MatchHistoryItemSchema),
});

export type Ranking = z.infer<typeof RankingSchema>;
export type TournamentStats = z.infer<typeof TournamentStatsSchema>;
export type PercentageWins = z.infer<typeof PercentageWinsSchema>;
export type MatchHistory = z.infer<typeof MatchHistorySchema>;
