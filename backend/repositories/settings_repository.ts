import { Settings, SettingsSchema } from '../../shared/schemas/settings.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import TournamentRepository from './tournament_repository.js';
import UserRepository from './user_repository.js';

const table = 'settings';

export default class SettingsRepository {
	static getSettingsByTournamentId(id: UUID): Settings | null {
		const result = db.queryOne<Settings>(
			`SELECT ${table}.id, max_score
		 FROM ${table}
		 INNER JOIN ${TournamentRepository.table}
		 ON ${table}.id = ${TournamentRepository.table}.settings_id
		 WHERE ${TournamentRepository.table}.id = ?`,
			[id]
		);

		if (!result) return null;
		return SettingsSchema.parse(result);
	}

	static getSettingsByUser(user_id: UUID): Settings | null {
		const result = db.queryOne<Settings>(
			`SELECT ${table}.id, max_score
		 FROM ${table}
		 INNER JOIN ${UserRepository.table}
		 ON ${table}.id = ${UserRepository.table}.settings_id
		 WHERE ${UserRepository.table}.id = ?`,
			[user_id]
		);

		if (!result) return null;
		return SettingsSchema.parse(result);
	}
}
