import * as z from 'zod';
import { sanitizedString, zUUID } from '../types.js';

const passwordSchema = z.string()
	.min(8, "Password must be at least 8 characters")
	.max(128, "Password must be at most 128 characters");

const loginSchema = z.string()
	.min(3, "Login must be at least 3 characters")
	.max(20, "Login must be at most 20 characters")
	.regex(/^[a-zA-Z0-9_-]+$/, "Login can contain only letters, numbers, _ or -")

const nameSchema = z.string()
	.min(2, "First and last name must be at least 2 characters")
	.max(128, "First and last name must be at most 128 characters")
	.regex(/^[a-zA-Z-\.\s]+$/, "Name can contain only letters, numbers, - or .")

export const UserSchema = z.object({
	id: zUUID,
	login: z.string(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email: z.string().nullable(),
	settings_id: zUUID,
});

export const CreateUserSchema = z.object({
	login: z.string().pipe(loginSchema),
	first_name: z.string().min(1).max(128).pipe(nameSchema).nullable(),
	last_name: z.string().min(1).max(128).pipe(nameSchema).nullable(),
	email: z.email().nullable(),
	password_hash: z.string().min(8).max(128),
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

