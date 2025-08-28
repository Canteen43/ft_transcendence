import Database, { RunResult } from 'better-sqlite3';
import path from 'path';
import { DEFAULT_DATABASE_PATH } from '../../shared/constants.js';

const dbPath = path.resolve(
	'../' + (process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH)
);

console.log(dbPath);

const db = new Database(dbPath);

export function queryOne<T>(sql: string, params: any[] = []): T | undefined {
	console.log('Executing SQL:', sql, 'with params:', params);
	return db.prepare(sql).get(...params) as T | undefined;
}

export function queryAll<T>(sql: string, params: any[] = []): T[] {
	return db.prepare(sql).all(...params) as T[];
}

export function execute(sql: string, params: any[] = []): RunResult {
	return db.prepare(sql).run(...params);
}

export function executeInTransaction<T>(callback: () => T): T {
	const transaction = db.transaction(callback);
	return transaction();
}
