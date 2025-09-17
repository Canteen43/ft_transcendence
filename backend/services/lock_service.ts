import { UUID } from '../../shared/types.js';

export enum LockType {
	Queue = 'queue',
	Auth = 'auth',
}

export class LockService {
	static locks: Map<string, Promise<any>> = new Map();

	static async withLock<T>(
		type: LockType,
		operation: () => Promise<T>
	): Promise<T> {
		const lockType = JSON.stringify(type);

		while (this.locks.has(lockType)) {
			await this.locks.get(lockType);
		}

		const promise = operation();
		this.locks.set(lockType, promise);

		try {
			return await promise;
		} finally {
			this.locks.delete(lockType);
		}
	}
}
