import * as db from '../utils/db.js';
import { CreateUser, User, UserSchema } from '../../shared/schemas/user.js';
import { DatabaseError } from '../../shared/exceptions.js';

export default class UserRepository {
	static table = '"user"';

	static async getUserByLogin(login: string): Promise<User | null> {
		const result = await db.pool.query<User>(
			`SELECT id, login, first_name, last_name, email
			 FROM ${this.table}
			 WHERE login = $1`,
			[login]
		);

		if (result.rows.length === 0) return null;
		return UserSchema.parse(result.rows[0]);
	}

	static async createUser(user: CreateUser): Promise<User> {
		const result = await db.pool.query<User>(
			`INSERT INTO ${this.table} (
				login,
				first_name,
				last_name,
				email,
				password_hash
			) VALUES ($1, $2, $3, $4, $5)
			RETURNING id,
					  login,
					  first_name,
					  last_name,
					  email`,
			[
				user.login,
				user.first_name,
				user.last_name,
				user.email,
				user.password_hash,
			]
		);
		if (result.rowCount == 0)
			throw new DatabaseError('Failed to create user');
		return UserSchema.parse(result.rows[0]);
	}

	static async authenticateUser(
		login: string,
		passwordHash: string
	): Promise<User | null> {
		const result = await db.pool.query<User>(
			`SELECT login, first_name, last_name, email
			FROM ${this.table}
			WHERE login = $1 AND password_hash = $2`,
			[login, passwordHash]
		);
		if (result.rows.length === 0) return null;
		return UserSchema.parse(result.rows[0]);
	}
}
