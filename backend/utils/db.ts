import type { Database as DBType } from 'better-sqlite3';
import Database, { RunResult } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
	CREATE_DB_SCRIPT,
	DATABASE_PATH_NOT_SET,
	UNABLE_TO_CREATE_DATABASE,
	UNABLE_TO_OPEN_DATABASE,
} from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

function createDb(path: string) {
	const db = new Database(dbPath);
	const sql = fs.readFileSync(CREATE_DB_SCRIPT, 'utf8');
	db.exec(sql);
	db.close();
}

if (!process.env.DATABASE_PATH) {
	logger.error(DATABASE_PATH_NOT_SET);
	process.exit(1);
}

const dbPath = path.resolve(process.env.DATABASE_PATH);

if (!fs.existsSync(dbPath)) {
	try {
		createDb(dbPath);
	} catch (error) {
		logger.error(`${UNABLE_TO_CREATE_DATABASE} ${dbPath}`);
		logger.debug(error);
		process.exit(1);
	}
}

let db: DBType;
try {
	db = new Database(dbPath);

	// Let de backend get an exlusive lock on the database file
	db.pragma('locking_mode = EXCLUSIVE');

	// Force sqlite to read directly from the file instead of creating a memory map
	db.pragma('mmap_size = 0');
} catch (error) {
	logger.error(`${UNABLE_TO_OPEN_DATABASE} ${dbPath}`);
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
