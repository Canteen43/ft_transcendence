import { ZodType, z } from 'zod';
// z is a namespace containing all Zod functions and helpers. Toolbox that has
// all the functions to create schemas and helpers. TypeScript can infer the
// schema type automatically with z.infer<typeof schema>

// ZodType<T> is the TypeScript type representing a Zod schema.
// use ZodType<T> when you need to type a function parameter or a variable that
// can accept any Zod schema.

// const API_BASE = `http://localhost:${Number(process.env.PORT)}`;
const API_BASE = `http://localhost:8080`;

export async function apiCall<T>(
	method: string,
	route: string,
	schema: ZodType<T>,
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
			alert(` API error: ${res.status} ${res.statusText} (${route})`);
			console.error(
				` API error: ${res.status} ${res.statusText} (${route})`
			);
			return null;
		}

		const data = await res.json();

		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			alert(
				` Zod validation failed: ${res.status} ${res.statusText} (${route})`
			);
			console.error(
				' Zod validation failed:',
				z.treeifyError(parsed.error)
			);
			return null;
		}

		return parsed.data;
	} catch (err) {
		alert(` Network error for ${route}:`);
		console.error(` Network error for ${route}:`, err);
		return null;
	}
}
