'use strict';

import sensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import {
	fastifyZodOpenApiPlugin,
	fastifyZodOpenApiTransformers,
	serializerCompiler,
	validatorCompiler,
} from 'fastify-zod-openapi';
import tournamentRoutes from './routes/tournament.js';
import userRoutes from './routes/user.js';

// Pass --options via CLI arguments in command to enable these options.
const options = {};

export default async function fastifyInit(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
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

	// Load routes
	await fastify.register(userRoutes, { prefix: '/users' });
	await fastify.register(tournamentRoutes, { prefix: '/tournaments' });
}

const _options = options;
export { _options as options };
