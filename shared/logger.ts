import pino from 'pino';
import pretty from 'pino-pretty';

import { APP_LOG_LEVEL } from './constants.js';

export const logger =
	(process.env.NODE_ENV || '').toLowerCase() === 'development'
		? pino({ level: APP_LOG_LEVEL }, pretty())
		: pino({ level: APP_LOG_LEVEL });
