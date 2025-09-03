import { ZodSchema } from 'zod';

const API_BASE = 'http://localhost:8080';

export async function apiCall<T>(
	route: string,
	schema: ZodSchema<T>,
	body?: any
): Promise<T | null> {
	try {
		const options: RequestInit | undefined = body
			? {
					method: 'POST',
					headers: {
						"Content-Type": "application/json",
						...(token ? { "Authorization": `Bearer ${token}` } : {}),
					},
					...(body ? { body: JSON.stringify(body) } : {}),
					};

		const res = await fetch(`${API_BASE}${route}`, options);

		if (!res.ok) {
			console.error(
				`API error: ${res.status} ${res.statusText} (${route})`
			);
			return null;
		}

		const json = await res.json();

		// Validate using Zod
		const parsed = schema.safeParse(json);
		if (!parsed.success) {
			console.error('Zod validation failed:', parsed.error);
			return null;
		}

		return parsed.data;
	} catch (err) {
		console.error(`Network error for ${route}:`, err);
		return null;
	}
}


