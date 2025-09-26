import * as z from 'zod';
import { zUUID } from '../types.js';

const passwordRequirements = z
	.string()
	.min(8, 'must be at least 8 characters')
	.max(128, 'must be at most 128 characters')
	.regex(/[a-z]/, 'must contain at least one lowercase letter')
	.regex(/[A-Z]/, 'must contain at least one uppercase letter')
	.regex(/[0-9]/, 'must contain at least one number')
	.regex(/[^a-zA-Z0-9]/,'must contain at least one special character');

export const passwordSchema =
	process.env.NODE_ENV === 'development' ? z.string() : passwordRequirements;

const loginSchema = z
	.string()
	.min(3, 'at least 3 characters')
	.max(20, 'at most 20 characters')
	.regex(/^[a-zA-Z0-9_-]+$/,'can contain only letters, numbers, _ or -');

const nameSchema = z
	.string()
	.min(2, 'at least 2 characters')
	.max(128, 'at most 128 characters')
	.regex(/^[a-zA-Z-\.\s]+$/,'can contain only letters, numbers, - or .');

export const UserSchema = z.object({
	id: zUUID,
	login: z.string(),
	alias: z.string().nullable(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email: z.string().nullable(),
	settings_id: zUUID,
});

export const CreateUserSchema = z.object({
	login: z.string().pipe(loginSchema),
	alias: z.string().pipe(loginSchema).nullable(),
	first_name: z.string().pipe(nameSchema).nullable(),
	last_name: z.string().pipe(nameSchema).nullable(),
	email: z.email().nullable(),
	password: z.string().pipe(passwordSchema),
});

export const AuthRequestSchema = z.object({
	login: z.string(),
	password: z.string(),
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
