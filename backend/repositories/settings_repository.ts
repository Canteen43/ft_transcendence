import * as db from '../utils/db.js';
import UserRepository from './user_repository.js';
import { Settings, SettingsSchema } from '../../shared/schemas/settings.js';
import { UUID } from '../../shared/types.js';

const table = 'settings';

export default class SettingsRepository {
	static async getSettingsByUser(user_id: UUID): Promise<Settings | null> {
		const result = await db.pool.query(
			`SELECT ${table}.id, max_score
			 FROM ${table}
			 INNER JOIN ${UserRepository.table}
			 	ON ${table}.id = ${UserRepository.table}.settings_id
			 WHERE ${UserRepository.table}.id = $1`,
			[user_id]
		);
		if (result.rows.length === 0) return null;
		return SettingsSchema.parse(result.rows[0]);
	}
}
