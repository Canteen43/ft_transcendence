import pg from 'pg'
import * as zod from "zod";
import * as user from '../../shared/user.js'
import * as db from '../utils/db.js';

export default class UserRepository {
	static async getUserByLogin(login: string): Promise<user.User | null> {
		const result = await db.pool.query<user.User>(
			'SELECT login, first_name, last_name, email FROM "user" WHERE login = $1',
			[login]
		);

		if (result.rows.length === 0) return null;
		return user.UserSchema.parse(result.rows[0]);
	}
}
