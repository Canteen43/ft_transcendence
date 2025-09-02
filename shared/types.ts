import * as z from 'zod';
import { UpdateMatch } from './schemas/match.js';
import sanitizeHtml from "sanitize-html";
import { EMPTY_UUID, MESSAGE_DECLINE, MESSAGE_GAME_STATE, MESSAGE_INITIATE_MATCH } from './constants.js';

export type UUID = `${string}-${string}-${string}-${string}-${string}` & {
	readonly length: 36;
	readonly __brand: 'UUID';
};

export const zUUID: z.ZodType<UUID> = z.uuid()
	.refine((val): val is UUID => val.length === 36, {
		message: 'Invalid UUID',
	}) as unknown as z.ZodType<UUID>;

type UpdateMatchEntry = {
	id: UUID;
	updateMatch: UpdateMatch;
};

export type UpdateMatchArray = UpdateMatchEntry[];

export interface Vect2 {
	x: number;
	y: number;
}

export interface Message {
	t: string;
	d?: string;
	l?: number[];
}
