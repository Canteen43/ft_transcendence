'use strict';

import fastifyCors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import {
	fastifyZodOpenApiPlugin,
	fastifyZodOpenApiTransformers,
	serializerCompiler,
	validatorCompiler,
} from 'fastify-zod-openapi';
import { authHook } from './hooks/auth.js';
import tournamentRoutes from './routes/tournament.js';
import userRoutes from './routes/user.js';

// Pass --options via CLI arguments in command to enable these options.
const options = {};

export default async function fastifyInit(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.register(fastifyCors, {
		origin: '*', // allow all origins for now
	});

	// Configure swagger
	await fastify.register(fastifyZodOpenApiPlugin);
	await fastify.register(fastifySwagger, {
		openapi: {
			info: {
				title: 'Transcendence API documentation',
				version: '0.1.0',
			},
			openapi: '3.1.0',
		},
		...fastifyZodOpenApiTransformers,
	});
	await fastify.register(fastifySwaggerUI, {
		routePrefix: '/docs',
	});

	// Set validators
	fastify.setValidatorCompiler(validatorCompiler);
	fastify.setSerializerCompiler(serializerCompiler);

	// Load sensible
	await fastify.register(sensible);

	// Enable websockets
	await fastify.register(websocket);

	// Load routes
	await fastify.register(userRoutes, { prefix: '/users' });
	await fastify.register(tournamentRoutes, { prefix: '/tournaments' });

	fastify.addHook('preHandler', authHook);
}

const _options = options;
export { _options as options };
