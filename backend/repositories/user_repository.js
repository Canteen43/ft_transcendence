import pg from 'pg'

export default class UserRepository {
	static async getUserByLogin(login) {
		const client = new pg.Client({
			connectionString: process.env.DATABASE_URL
		});

		await client.connect();

		const result = await client.query(
			'SELECT login, first_name, last_name, email FROM users WHERE login = $1',
			[login]
		);

		await client.end();
		return result.rows[0] || null;
	}
}
