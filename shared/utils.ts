import { ZodError } from 'zod';
import * as constants from './constants.js';

export function randomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function zodError(error: ZodError): string {
	return error.issues[0]?.message ?? constants.ERROR_INVALID_INPUT;
}
