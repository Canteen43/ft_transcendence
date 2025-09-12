import pino from 'pino';
import pretty from 'pino-pretty';

import { APP_LOG_LEVEL } from './constants.js';

export const logger = pino({
	level: APP_LOG_LEVEL,
	redact: {
		paths: ['params.password', 'params.token'],
		censor: '[REDACTED]',
	},
	transport:
		(process.env.NODE_ENV || '').toLowerCase() === 'development'
			? { target: 'pino-pretty' }
			: undefined,
});
