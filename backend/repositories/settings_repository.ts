import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as settingsSchemas from '../../shared/schemas/settings.js'
import * as user from '../../shared/schemas/user.js'
import { UUID } from '../../shared/types.js'

export default class SettingsRepository {
	static async getSettingsByUser(user_id: UUID): Promise<settingsSchemas.Settings | null> {
		const result = await db.pool.query(
			`SELECT id, max_score
			 FROM settings
			 INNER JOIN users
			 	ON settings.id = users.settings_id
			 WHERE users.id = $1`,
			 [user_id]
		);
		if (result.rows.length === 0) return null;
		return settingsSchemas.SettingsSchema.parse(result.rows[0]);
	}
}
