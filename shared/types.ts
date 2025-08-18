import * as z from 'zod';

export type UUID = `${string}-${string}-${string}-${string}-${string}` & {
	readonly length: 36;
	readonly __brand: 'UUID';
};

export const zUUID: z.ZodType<UUID> = z
	.uuid()
	.refine((val): val is UUID => val.length === 36, {
		message: 'Invalid UUID',
	}) as unknown as z.ZodType<UUID>;
