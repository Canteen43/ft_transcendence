import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as userSchemas from '../../shared/schemas/user.js'

const table = '"user"'

export default class UserRepository {
	static async getUserByLogin(login: string): Promise<userSchemas.User | null> {
		const result = await db.pool.query<userSchemas.User>(
			`SELECT id, login, first_name, last_name, email
			 FROM ${table}
			 WHERE login = $1`,
			 [login]
		);

		if (result.rows.length === 0) return null;
		return userSchemas.UserSchema.parse(result.rows[0]);
	}

	static async createUser(user: userSchemas.CreateUser) {
		const result = await db.pool.query<userSchemas.User>(
			`INSERT INTO ${table} (login, first_name, last_name, email, password_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, login, first_name, last_name, email`,
			 [user.login, user.first_name, user.last_name, user.email, user.password_hash]
		);
		return userSchemas.UserSchema.parse(result.rows[0]);
	}

	static async authenticateUser(login: string, passwordHash: string): Promise<userSchemas.User | null> {
		const result = await db.pool.query<userSchemas.User>(
			`SELECT login, first_name, last_name, email
			FROM ${table}
			WHERE login = $1 AND password_hash = $2`,
			[login, passwordHash]
		);
		if (result.rows.length === 0) return null;
		return userSchemas.UserSchema.parse(result.rows[0]);
	}
}
