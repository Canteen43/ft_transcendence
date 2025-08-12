import * as zod from "zod";

export const SettingsSchema = zod.object({
	id: 			zod.uuid(),
	max_score:		zod.number().int(),
});

export const CreateSettingsSchema = SettingsSchema.omit({ id: true });

export type Settings = zod.infer<typeof SettingsSchema>
export type CreateSettings = zod.infer<typeof CreateSettingsSchema>
