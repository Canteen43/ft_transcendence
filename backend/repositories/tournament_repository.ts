import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as tournamentSchemas from '../../shared/schemas/tournament.js'
import * as user from '../../shared/schemas/user.js'

export default class TournamentRepository {
	static async createTournament(tournament: tournamentSchemas.CreateDbTournament): Promise<tournamentSchemas.Tournament | null> {
		return null;
	}
}
