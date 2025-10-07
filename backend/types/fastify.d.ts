import 'fastify';
import { AuthPayload } from './interfaces.ts';

declare module 'fastify' {
	interface FastifyRequest {
		token?: AuthPayload;
	}
	interface FastifyContextConfig {
		secure?: boolean;
	}
}
