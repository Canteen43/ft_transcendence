import * as z from 'zod';
import { zUUID } from '../types.js';

export const SettingsSchema = z.object({
	id: zUUID,
	max_score: z.number().int(),
});

export const CreateSettingsSchema = SettingsSchema.omit({ id: true });

export type Settings = z.infer<typeof SettingsSchema>;
export type CreateSettings = z.infer<typeof CreateSettingsSchema>;
