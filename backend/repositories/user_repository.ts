import pg from 'pg'
import { User } from '../../shared/user.js'
import { pool } from '../utils/db.js';

export default class UserRepository {
	static async getUserByLogin(login: string): Promise<User | null> {
		const client = new pg.Client({
			connectionString: process.env.DATABASE_URL
		});

		await client.connect();

		const result = await pool.query<User>(
			'SELECT login, first_name, last_name, email FROM "user" WHERE login = $1',
			[login]
		);

		await client.end();
		return result.rows[0] || null;
	}
}
