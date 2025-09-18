import { ZodType, z } from 'zod';

const API_BASE = `http://${import.meta.env.VITE_API_HOST}:${import.meta.env.VITE_API_PORT}`;

export async function apiCall<T>(
	method: string,
	route: string,
	schema?: ZodType<T>,
	body?: unknown
): Promise<T | null> {
	try {
		const token = sessionStorage.getItem('token');

		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		if (body) headers['Content-Type'] = 'application/json';

		const options: RequestInit = {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		};

		const res = await fetch(`${API_BASE}${route}`, options);

		if (!res.ok) {
			console.warn(
				`API error: ${res.status} ${res.statusText} (${route})`
			);
			return null;
		}

		console.info(`API returned 200-OK for ${route}`);
		if (!schema) return null;

		const data = await res.json();

		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			console.warn(
				'Zod validation failed:',
				z.treeifyError(parsed.error)
			);
			return null;
		}
		return parsed.data;
	} catch (err) {
		console.warn(`Network error for ${route}:`, err);
		return null;
	}
}
