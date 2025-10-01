import 'fastify';
import Token from '../../shared/enums.ts';

declare module 'fastify' {
	interface FastifyRequest {
		token?: {
			userId: UUID;
			type: Token;
		};
	}
	interface FastifyContextConfig {
		secure?: boolean;
	}
}
