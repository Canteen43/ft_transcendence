import 'fastify';

declare module 'fastify' {
	interface FastifyRequest {
		user?: {
			userId: UUID;
		};
	}
	interface FastifyContextConfig {
		secure?: boolean;
	}
}
