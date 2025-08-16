import dotenv from 'dotenv';
import Fastify from 'fastify';
import fastifyApp from './fastify.js';
import type { FastifyInstance } from 'fastify';
import { FASTIFY_LOG_LEVEL } from '../shared/constants.js';

// Load .env
dotenv.config();

const fastify: FastifyInstance = Fastify({
	logger: { level: FASTIFY_LOG_LEVEL },
});

await fastify.register(fastifyApp);

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

start();
