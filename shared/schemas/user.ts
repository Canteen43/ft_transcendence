import * as z from 'zod';
import { sanitizedString, zUUID } from '../types.js';

export const UserSchema = z.object({
	id: zUUID,
	login: sanitizedString,
	first_name: sanitizedString,
	last_name: sanitizedString,
	email: sanitizedString,
});

export const CreateUserSchema = UserSchema.omit({ id: true }).extend({
	password_hash: z.string(),
});

export const AuthRequestSchema = z.object({
	login: z.string(),
	password_hash: z.string(),
});

export const AuthResponseSchema = z.object({
	login: z.string(),
	token: z.string(),
});

export type User = z.infer<typeof UserSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
