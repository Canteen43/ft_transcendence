import dotenv from 'dotenv';
import { DOTENV_BACKEND } from '../shared/constants.js';

if (process.env.ENVIRONMENT !== 'production')
	dotenv.config({ path: DOTENV_BACKEND });
