import * as zod from "zod";

export const UserSchema = zod.object({
	login: zod.string(),
	first_name: zod.string().nullable(),
	last_name: zod.string().nullable(),
	email: zod.string().nullable(),
});

export type User = zod.infer<typeof UserSchema>
