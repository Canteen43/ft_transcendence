import * as z from 'zod';
import { zUUID } from '../types.js';

const passwordRequirements = z
	.string()
	.min(8, 'must be at least 8 characters')
	.max(128, 'must be at most 128 characters')
	.regex(/[a-z]/, 'must contain at least one lowercase letter')
	.regex(/[A-Z]/, 'must contain at least one uppercase letter');

export const passwordSchema =
	process.env.NODE_ENV?.toLowerCase() === 'development'
		? z.string()
		: passwordRequirements;

const loginSchema = z
	.string()
	.min(3, 'at least 3 characters')
	.max(20, 'at most 20 characters')
	.regex(/^[a-zA-Z0-9_-]+$/, 'can contain only letters, numbers, _ or -');

const nameSchema = z
	.string()
	.min(2, 'at least 2 characters')
	.max(128, 'at most 128 characters')
	.regex(/^[a-zA-Z-\.\s]+$/, 'can contain only letters, numbers, - or .');

export const UserSchema = z.object({
	id: zUUID,
	login: z.string(),
	alias: z.string().nullable(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email: z.string().nullable(),
	settings_id: zUUID,
	two_factor_enabled: z.preprocess(val => {
		if (typeof val === 'boolean') return val;
		const validated = z.number().min(0).max(1).parse(val);
		return validated === 1;
	}, z.boolean()),
});

export const CreateUserSchema = z.object({
	login: z.string().pipe(loginSchema),
	alias: z.string().pipe(loginSchema).nullable(),
	first_name: z.string().pipe(nameSchema).nullable(),
	last_name: z.string().pipe(nameSchema).nullable(),
	email: z.email().nullable(),
	password: z.string().pipe(passwordSchema),
	two_factor_enabled: z.preprocess(val => {
		if (typeof val === 'boolean') return val;
		const validated = z.number().min(0).max(1).parse(val);
		return validated === 1;
	}, z.boolean()),
});

export const AuthRequestSchema = z.object({
	login: z.string(),
	password: z.string(),
});

export const AuthResponseSchema = z
	.object({
		login: z.string(),
		user_id: zUUID,
		token: z.string(),
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

export const QRCodeSchema = z.object({ data: z.string() });

export type User = z.infer<typeof UserSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type TwoFactorUpdate = z.infer<typeof TwoFactorUpdateSchema>;
export type QRCode = z.infer<typeof QRCodeSchema>;
