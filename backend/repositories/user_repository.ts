import bcrypt from 'bcrypt';
import {
	DEFAULT_MAX_SCORE,
	ERROR_FAILED_TO_CREATE_USER,
} from '../../shared/constants.js';
import { DatabaseError } from '../../shared/exceptions.js';
import {
	AuthRequest,
	CreateUser,
	User,
	UserSchema,
} from '../../shared/schemas/user.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import SettingsRepository from './settings_repository.js';

export default class UserRepository {
	static table = '"user"';
	static fields = 'id, login, first_name, last_name, email, settings_id';

	static getUser(id: UUID): User | null {
		const row = db.queryOne<User>(
			`SELECT ${this.fields}
			FROM ${this.table}
			WHERE id = ?`,
			[id]
		);

		if (!row) return null;
		return UserSchema.parse(row);
	}

	static getUserByLogin(login: string): User | null {
		const row = db.queryOne<User>(
			`SELECT ${this.fields}
			FROM ${this.table}
			WHERE login = ?`,
			[login]
		);

		if (!row) return null;
		return UserSchema.parse(row);
	}

	static async createUser(user: CreateUser): Promise<User> {
		const hash = await bcrypt.hash(user.password, 10);
		const settings = { max_score: DEFAULT_MAX_SCORE };

		return db.executeInTransaction(() => {
			const dbSettings = SettingsRepository.createSettings(settings);
			const row = db.queryOne<User>(
				`INSERT INTO ${this.table} (login, first_name, last_name, email, settings_id, password_hash)
				VALUES (?, ?, ?, ?, ?, ?)
				RETURNING ${this.fields}`,
				[
					user.login,
					user.first_name,
					user.last_name,
					user.email,
					dbSettings.id,
					hash,
				]
			);

			if (!row) throw new DatabaseError(ERROR_FAILED_TO_CREATE_USER);
			return UserSchema.parse(row);
		});
	}

	static async authenticateUser(request: AuthRequest): Promise<User | null> {
		const hash = await bcrypt.hash(request.password, 10);
		const query = `
			SELECT ${this.fields}
			FROM ${this.table}
			WHERE login = ? AND password_hash = ?`;
		let row = db.queryOne<User>(query, [request.login, hash]);

		if (!row && process.env.NODE_ENV == 'development')
			row = db.queryOne<User>(query, [request.login, request.password]);

		if (!row) return null;
		return UserSchema.parse(row);
	}
}
