import * as pg from 'pg';

export const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL
});
