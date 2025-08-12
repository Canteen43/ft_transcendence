import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as user from '../../shared/schemas/user.js'

const table = '"user"'

export default class UserRepository {
	static async getUserByLogin(login: string): Promise<user.User | null> {
		const result = await db.pool.query<user.User>(
			`SELECT id, login, first_name, last_name, email
			 FROM ${table}
			 WHERE login = $1`,
			 [login]
		);

		if (result.rows.length === 0) return null;
		return user.UserSchema.parse(result.rows[0]);
	}

	static async createUser(usr: user.CreateUser) {
		const result = await db.pool.query<user.User>(
			`INSERT INTO ${table} (login, first_name, last_name, email, password_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, login, first_name, last_name, email`,
			 [usr.login, usr.first_name, usr.last_name, usr.email, usr.password_hash]
		);
		return user.UserSchema.parse(result.rows[0]);
	}

	static async authenticateUser(login: string, passwordHash: string): Promise<user.User | null> {
		const result = await db.pool.query<user.User>(
			`SELECT login, first_name, last_name, email
			FROM ${table}
			WHERE login = $1 AND password_hash = $2`,
			[login, passwordHash]
		);
		if (result.rows.length === 0) return null;
		return user.UserSchema.parse(result.rows[0]);
	}
}
