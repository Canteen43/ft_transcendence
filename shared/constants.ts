import { Player } from '../backend/types/interfaces.js';
import { ParticipantStatus } from './enums.js';
import { UUID } from './types.js';

export const ERROR_CREATE_USER_FAILED = 'Failed to create user';
export const ERROR_INVALID_CREDENTIALS = 'Invalid login credentials';
export const ERROR_INVALID_INPUT = 'Invalid input';
export const ERROR_INVALID_TOURNAMENT_SIZE =
	'Invalid number of tournament participants';
export const ERROR_REQUEST_FAILED =
	'Unexpected error occurred while processing request';
export const ERROR_USER_NOT_FOUND = 'User not found';
export const ERROR_TOURNAMENT_CREATION_FAILED = 'Tournament creation failed';
export const ERROR_RETRIEVING_WINNERS = 'Error retrieving match winners';
export const ERROR_RETRIEVING_NEXT_ROUND =
	'Error retrieving next round matches';
export const ERROR_INVALID_TOKEN = 'Invalid token';
export const ERROR_TOKEN_EXPIRED = 'Token is expired';
export const ERROR_UNABLE_TO_PROCESS_AUTHENTICATION_REQUEST =
	'Unable to process the authentication request';
export const ERROR_NO_TOKEN = 'No token provided';
export const ERROR_MALFORMED_TOKEN = 'Malformed token';
export const ERROR_AUTHENTICATION_FAILED = 'Authentication failed';
export const ERROR_USER_CONNECTION_NOT_FOUND = 'User connection not found';

export const TOKEN_VALIDITY_PERIOD = '1h';

export const ALLOWED_TOURNAMENT_SIZES = [2, 4];
export const FIELD_WIDTH = 1800;
export const FIELD_HEIGTH = 1000;
export const PADDLE_WIDTH = 100;

export const FASTIFY_LOG_LEVEL = 'info';
export const APP_LOG_LEVEL = 'debug';

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000' as UUID;
export const EMPTY_PLAYER: Player = {
	userId: EMPTY_UUID,
	score: 0,
	status: ParticipantStatus.Pending,
};

export const MESSAGE_INITIATE_TOURNAMENT = 't';
export const MESSAGE_INITIATE_MATCH = 'i';
export const MESSAGE_START_TOURNAMENT = 'st';
export const MESSAGE_START = 's';
export const MESSAGE_QUIT = 'q';
export const MESSAGE_PAUSE = 'p';
export const MESSAGE_MOVE = 'm';
export const MESSAGE_ACCEPT = 'a';
export const MESSAGE_DECLINE = 'd';

export const INVITATION_MESSAGE = { t: MESSAGE_INITIATE_MATCH };
export const MATCH_START_MESSAGE = { t: MESSAGE_START };
export const TOURNAMENT_START_MESSAGE = { t: MESSAGE_START_TOURNAMENT };
