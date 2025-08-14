import * as zod from 'zod';
import { zUUID } from '../types.js';

export const UserSchema = zod.object({
	id: zUUID,
	login: zod.string(),
	first_name: zod.string().nullable(),
	last_name: zod.string().nullable(),
	email: zod.string().nullable(),
});

export const CreateUserSchema = UserSchema.omit({ id: true }).extend({
	password_hash: zod.string(),
});

export const AuthenticateUserSchema = zod.object({
	login: zod.string(),
	password_hash: zod.string(),
});

export type User = zod.infer<typeof UserSchema>;
export type AuthenticateUser = zod.infer<typeof AuthenticateUserSchema>;
export type CreateUser = zod.infer<typeof CreateUserSchema>;
