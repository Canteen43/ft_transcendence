import * as zod from "zod";

export type UUID = `${string}-${string}-${string}-${string}-${string}` & {
	readonly length: 36;
	readonly __brand: 'UUID'
};

export const zUUID: zod.ZodType<UUID> = zod
	.uuid()
	.refine((val): val is UUID => val.length === 36, {
	message: "Invalid UUID length",
}) as unknown as zod.ZodType<UUID>;

