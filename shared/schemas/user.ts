import * as z from 'zod';
import { sanitizedString, zUUID } from '../types.js';

export const UserSchema = z.object({
	id: zUUID,
	login: z.string(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email: z.string().nullable(),
});

export const CreateUserSchema = UserSchema.omit({ id: true }).extend({
	login: sanitizedString,
	first_name: sanitizedString.nullable(),
	last_name: sanitizedString.nullable(),
	email: sanitizedString.nullable(),
	password_hash: z.string(),
});

export const AuthRequestSchema = z.object({
	login: z.string(),
	password_hash: z.string(),
});

export const AuthResponseSchema = z.object({
	login: z.string(),
	user_id: zUUID,
	token: z.string(),
});

export type User = z.infer<typeof UserSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;


