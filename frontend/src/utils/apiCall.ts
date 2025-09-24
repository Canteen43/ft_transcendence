import { ZodType, z } from 'zod';
import { TextModal } from '../modals/TextModal';

// property/method	type			meaning
// res.ok			boolean			true if the status is in the range 200–299 (success). false otherwise.
// res.status		number			The HTTP status code (e.g. 200, 404, 409, 500).
// res.statusText	string			The HTTP status text (e.g. "OK", "Not Found", "Conflict").
// res.headers		Headers object	Access to response headers. Example: res.headers.get('Content-Type').
// res.url			string			The final URL after redirects.
// res.redirected	boolean			true if the response came from a redirect.
// res.type			`basic			cors
// res.body			ReadableStream	Low-level stream of the body.
// res.clone()		returns a new Response	Lets you read the body twice.

const API_BASE = `http://${import.meta.env.VITE_API_HOST}:${import.meta.env.VITE_API_PORT}`;

type ApiError = {
	status: number;
	statusText: string;
	message: string;
};

export async function apiCall<T>(
	method: string,
	route: string,
	schema?: ZodType<T>,
	body?: unknown
): Promise<{ data: T | null; error?: ApiError }> {
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
			// alert(`TEMP ALERT: ${res.status} ${res.statusText}` )
			let message = `${res.status} ${res.statusText}`;
			const errBody = await res.json();
			if (typeof errBody?.message === 'string') {
				message = errBody.message;
			}

			return {
				data: null,
				error: {
					status: res.status,
					statusText: res.statusText,
					message,
				},
			};
		}

		if (!schema) {
			return { data: null };
		}

		const data = await res.json();
		const parsed = schema.safeParse(data);
		if (!parsed.success) {
			console.error(
				'Zod validation failed:',
				z.treeifyError(parsed.error)
			);
			return {
				data: null,
				error: {
					status: 200,
					statusText: 'OK',
					message: 'Invalid response (schema) from server',
				},
			};
		}
		return { data: parsed.data };
	} catch (err) {
		console.error(`Network error for ${route}:`, err);
		return {
			data: null,
			error: {
				status: 0,
				statusText: 'Network Error',
				message: (err as Error).message,
			},
		};
	}
}
