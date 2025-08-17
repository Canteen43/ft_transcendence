import dotenv from 'dotenv';
import Fastify from 'fastify';
import fastifyApp from './fastify.js';
import type { FastifyInstance } from 'fastify';
import { FASTIFY_LOG_LEVEL } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

// Load .env
dotenv.config();

const fastify: FastifyInstance = Fastify({
	logger: { level: FASTIFY_LOG_LEVEL },
});

try {
	await fastify.register(fastifyApp);
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
