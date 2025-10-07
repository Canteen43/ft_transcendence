import type { Database as DBType } from 'better-sqlite3';
import Database, { RunResult } from 'better-sqlite3';
import path from 'path';
import { DEFAULT_DATABASE_PATH } from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

const dbPath = path.resolve(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH);

let db: DBType;
try {
	db = new Database(dbPath);
} catch (error) {
	logger.error(`Unable to open database: ${dbPath}`);
	throw error;
}

export function queryOne<T>(sql: string, params: any[] = []): T | undefined {
	logger.trace({ sql, params }, 'Executing SQL');
	return db.prepare(sql).get(...params) as T | undefined;
}

export function queryAll<T>(sql: string, params: any[] = []): T[] {
	logger.trace({ sql, params }, 'Executing SQL');
	return db.prepare(sql).all(...params) as T[];
}

export function execute(sql: string, params: any[] = []): RunResult {
	logger.trace({ sql, params }, 'Executing SQL');
	return db.prepare(sql).run(...params);
}

export function executeInTransaction<T>(callback: () => T): T {
	const transaction = db.transaction(callback);
	return transaction();
}
