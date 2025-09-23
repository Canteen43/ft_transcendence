import bcrypt from 'bcrypt';
import { SqliteError } from 'better-sqlite3';
import {
	DEFAULT_MAX_SCORE,
	ERROR_FAILED_TO_CREATE_USER,
} from '../../shared/constants.js';
import {
	DatabaseError,
	UserAlreadyExistsError,
} from '../../shared/exceptions.js';
import {
	AuthRequest,
	CreateUser,
	User,
	UserSchema,
} from '../../shared/schemas/user.js';
import { UUID } from '../../shared/types.js';
import { UserAuth } from '../types/interfaces.js';
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

			let row: User | undefined;
			try {
				row = db.queryOne<User>(
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
			} catch (error: any) {
				if (
					error instanceof SqliteError &&
					error.code == 'SQLITE_CONSTRAINT_UNIQUE'
				)
					throw new UserAlreadyExistsError(user.login);
				throw error;
			}

			if (!row) throw new DatabaseError(ERROR_FAILED_TO_CREATE_USER);
			return UserSchema.parse(row);
		});
	}

	static async authenticateUser(request: AuthRequest): Promise<User | null> {
		const query = `
			SELECT id, password_hash
			FROM ${this.table}
			WHERE login = ? `;
		let row = db.queryOne<UserAuth>(query, [request.login]);

		if (!row) return null;

		let valid = await bcrypt.compare(request.password, row.password_hash);

		if (!valid && process.env.NODE_ENV == 'development')
			valid = request.password == row.password_hash;

		if (!valid) return null;

		return this.getUser(row.id);
	}
}
