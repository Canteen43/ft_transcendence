import './init.js';

import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi';
import { FASTIFY_LOG_LEVEL } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import fastifyInit from './fastify.js';

const fastify: FastifyInstance = Fastify({
	logger: { level: FASTIFY_LOG_LEVEL },
}).withTypeProvider<FastifyZodOpenApiTypeProvider>();

try {
	await fastify.register(fastifyInit);
} catch (error) {
	logger.error('Failed to register application:');
	logger.error(error);
	process.exit(1);
}

async function start(): Promise<void> {
	try {
		await fastify.listen({
			port: Number(process.env.PORT),
			host: '0.0.0.0',
		});
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

try {
	start();
} catch (error) {
	logger.error('Failed to launch application:');
	logger.error(error);
	process.exit(1);
}
