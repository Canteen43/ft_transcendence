'use strict';

import path from 'node:path';
import AutoLoad from '@fastify/autoload';
import url from 'node:url';
import type { FastifyInstance } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
// import sensible from '@fastify/sensible';
// import userRoutes from './routes/user.js';
// import tournamentRoutes from './routes/tournament.js';

// Pass --options via CLI arguments in command to enable these options.
const options = {};

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	// Set validators
	fastify.setValidatorCompiler(validatorCompiler);
	fastify.setSerializerCompiler(serializerCompiler);

	// Load all plugins
	fastify.register(AutoLoad, {
		dir: path.join(__dirname, 'plugins'),
		options: Object.assign({}, opts),
	});

	//Load all routes
	fastify.register(AutoLoad, {
		dir: path.join(__dirname, 'routes'),
		options: Object.assign({}, opts),
	});

	// fastify.register(sensible);
	// fastify.register(userRoutes);
	// fastify.register(tournamentRoutes);
}

const _options = options;
export { _options as options };
