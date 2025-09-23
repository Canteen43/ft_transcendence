import * as z from 'zod';
import { zUUID } from '../types.js';

const passwordRequirements = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.max(128, 'Password must be at most 128 characters')
	.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
	.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
	.regex(/[0-9]/, 'Password must contain at least one number')
	.regex(
		/[^a-zA-Z0-9]/,
		'Password must contain at least one special character'
	);

export const passwordSchema =
	process.env.NODE_ENV === 'development' ? z.string() : passwordRequirements;

const loginSchema = z
	.string()
	.min(3, 'Login must be at least 3 characters')
	.max(20, 'Login must be at most 20 characters')
	.regex(
		/^[a-zA-Z0-9_-]+$/,
		'Login can contain only letters, numbers, _ or -'
	);

const nameSchema = z
	.string()
	.min(2, 'First and last name must be at least 2 characters')
	.max(128, 'First and last name must be at most 128 characters')
	.regex(
		/^[a-zA-Z-\.\s]+$/,
		'Name can contain only letters, numbers, - or .'
	);

export const UserSchema = z.object({
	id: zUUID,
	login: z.string(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email: z.string().nullable(),
	settings_id: zUUID,
	two_factor_enabled: z.boolean(),
});

export const CreateUserSchema = z.object({
	login: z.string().pipe(loginSchema),
	first_name: z.string().pipe(nameSchema).nullable(),
	last_name: z.string().pipe(nameSchema).nullable(),
	email: z.email().nullable(),
	password: z.string().pipe(passwordSchema),
	two_factor_enabled: z.boolean(),
});

export const AuthRequestSchema = z.object({
	login: z.string(),
	password: z.string(),
});

export const AuthResponseSchema = z
	.object({
		login: z.string(),
		user_id: zUUID,
		token: z.string().optional(),
		two_factor_enabled: z.boolean(),
	})
	.refine(data => data.two_factor_enabled || data.token !== undefined);

export const TwoFactorUpdateSchema = z
	.object({
		two_factor_enabled: z.boolean().optional(),
		two_factor_temp_secret: z.string().nullable().optional(),
		two_factor_secret: z.string().nullable().optional(),
	})
	.refine(
		data =>
			data.two_factor_enabled !== undefined ||
			data.two_factor_temp_secret !== undefined ||
			data.two_factor_secret !== undefined,
		{ message: 'At least one field must be provided' }
	)
	.refine(data => !data.two_factor_enabled || !!data.two_factor_secret, {
		message:
			'two_factor_secret is required when two_factor_enabled is true',
	});

export type User = z.infer<typeof UserSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type TwoFactorUpdate = z.infer<typeof TwoFactorUpdateSchema>;
