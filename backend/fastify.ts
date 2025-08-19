'use strict';

import sensible from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
import tournamentRoutes from './routes/tournament.js';
import userRoutes from './routes/user.js';

// Pass --options via CLI arguments in command to enable these options.
const options = {};

export default async function fastifyInit(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	// Set validators
	fastify.setValidatorCompiler(validatorCompiler);
	fastify.setSerializerCompiler(serializerCompiler);

	// Load sensible
	fastify.register(sensible);

	// Load routes
	fastify.register(userRoutes, { prefix: '/users' });
	fastify.register(tournamentRoutes, { prefix: '/tournaments' });
}

const _options = options;
export { _options as options };
