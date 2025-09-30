import { ERROR_FAILED_TO_CREATE_SETTINGS } from '../../shared/constants.js';
import { DatabaseError } from '../../shared/exceptions.js';
import {
	CreateSettings,
	Settings,
	SettingsSchema,
} from '../../shared/schemas/settings.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import TournamentRepository from './tournament_repository.js';
import UserRepository from './user_repository.js';

export default class SettingsRepository {
	static table = 'settings';
	static fields = 'id, max_score';

	static getSettingsByTournamentId(id: UUID): Settings | null {
		const result = db.queryOne<Settings>(
			`SELECT ${this.table}.id, max_score
		 FROM ${this.table}
		 INNER JOIN ${TournamentRepository.table}
		 ON ${this.table}.id = ${TournamentRepository.table}.settings_id
		 WHERE ${TournamentRepository.table}.id = ?`,
			[id]
		);

		if (!result) return null;
		return SettingsSchema.parse(result);
	}

	static getSettingsByUser(user_id: UUID): Settings | null {
		const result = db.queryOne<Settings>(
			`SELECT ${this.table}.id, max_score
		 FROM ${this.table}
		 INNER JOIN ${UserRepository.table}
		 ON ${this.table}.id = ${UserRepository.table}.settings_id
		 WHERE ${UserRepository.table}.id = ?`,
			[user_id]
		);

		if (!result) return null;
		return SettingsSchema.parse(result);
	}

	static createSettings(src: CreateSettings) {
		const row = db.queryOne<CreateSettings>(
			`INSERT INTO ${this.table} (max_score)
			VALUES (?)
			RETURNING ${this.fields}`,
			[src.max_score]
		);

		if (!row) throw new DatabaseError(ERROR_FAILED_TO_CREATE_SETTINGS);
		return SettingsSchema.parse(row);
	}
}
