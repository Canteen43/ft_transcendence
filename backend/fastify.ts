'use strict';

import path from 'node:path';
import AutoLoad from '@fastify/autoload';
import url from 'node:url';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';

// Pass --options via CLI arguments in command to enable these options.
const options = {};

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	// Load all plugins
	fastify.register(AutoLoad, {
		dir: path.join(__dirname, 'plugins'),
		options: Object.assign({}, opts),
	});

	// Set validators
	fastify.setValidatorCompiler(validatorCompiler);
	fastify.setSerializerCompiler(serializerCompiler);

	// Configure swagger
	fastify.register(swagger, {
		openapi: {
			openapi: '3.0.0',
			info: {
				title: 'Your API',
				version: '1.0.0',
			},
		},
	});
	fastify.register(swaggerUI, {
		routePrefix: '/docs',
	});

	// Load all routes
	fastify.register(AutoLoad, {
		dir: path.join(__dirname, 'routes'),
		options: Object.assign({}, opts),
	});
}

const _options = options;
export { _options as options };
