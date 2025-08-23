'use strict';

import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient } from 'pg';

const transactionStorage = new AsyncLocalStorage<PoolClient>();

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

/**
 * Retrieves the current database client.
 * If called within an active transaction, returns the transaction's client.
 * Otherwise, returns the default connection pool.
 *
 * @returns {PoolClient | Pool} The active transaction client or the default pool.
 */
export function getClient(): PoolClient | Pool {
	return transactionStorage.getStore() || pool;
}

/**
 * Executes the provided callback inside a single database transaction.
 * Everything inside the callback will run in the same transaction and
 * will be rolled back if an error occurs.
 *
 * Uses AsyncLocalStorage to automatically provide the transaction's
 * database client to any function calls within the callback.
 *
 * @template T The type of the value returned by the callback.
 * @param {() => Promise<T>} callback - The async function to execute inside the transaction.
 * @returns {Promise<T>} The result of the callback execution.
 * @throws Will throw an error if the transaction fails.
 */
export async function executeInTransaction<T>(
	callback: () => Promise<T>
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Everything inside callback() can access this client automatically
		const result = await transactionStorage.run(client, callback);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}
