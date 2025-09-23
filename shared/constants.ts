import type { Player } from '../backend/types/interfaces.js';
import { PlayerStatus } from './enums.js';
import type { Message } from './schemas/message.js';
import type { UUID } from './types.js';

export const ERROR_CREATE_USER_FAILED = 'Failed to create user';
export const ERROR_INVALID_CREDENTIALS = 'Invalid login credentials';
export const ERROR_INVALID_INPUT = 'Invalid input';
export const ERROR_INVALID_TOURNAMENT_SIZE =
	'Invalid number of tournament participants';
export const ERROR_REQUEST_FAILED =
	'Unexpected error occurred while processing request';
export const ERROR_USER_NOT_FOUND = 'User not found';
export const ERROR_MATCH_NOT_FOUND = 'Match not found';
export const ERROR_TOURNAMENT_NOT_FOUND = 'Tournament not found';
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
export const ERROR_FAILED_TO_CREATE_USER = 'Failed to create user';
export const ERROR_FAILED_TO_CREATE_MATCH = 'Failed to create match';
export const ERROR_FAILED_TO_CREATE_PARTICIPANT =
	'Failed to create participant';
export const ERROR_FAILED_TO_CREATE_TOURNAMENT = 'Failed to create tournament';
export const ERROR_FAILED_TO_CREATE_SETTINGS =
	'Failed to create settings object';
export const ERROR_FAILED_TO_UPDATE_USER = 'Failed to update user';
export const ERROR_FAILED_TO_UPDATE_MATCH = 'Failed to update match';
export const ERROR_FAILED_TO_UPDATE_PARTICIPANT =
	'Failed to update participant';
export const ERROR_FAILED_TO_UPDATE_TOURNAMENT = 'Failed to update tournament';
export const ERROR_PLAYER_NOT_FOUND = 'Player not found in match';
export const ERROR_USER_ALREADY_EXISTS = 'User already exists';
export const ERROR_USER_ALREADY_CONNECTED = 'User already connected';
export const ERROR_USER_ALREADY_QUEUED = 'User already in queue';
export const ERROR_MESSAGE_HANDLE = 'Error while handling websocket message';
export const ERROR_QUIT = 'Error while trying to end tournament';
export const ERROR_NO_2FA_IN_PROGRESS =
	'No two factor authentication setup in progress';
export const ERROR_2FA_NOT_CONFIGURED =
	'Two factor authentication has not been setup for this account';

export const WS_CLOSE_POLICY_VIOLATION = 1008;
export const WS_AUTHENTICATION_FAILED = 4001;
export const WS_TOKEN_EXPIRED = 4002;
export const WS_ALREADY_CONNECTED = 4003;

export const TOKEN_VALIDITY_PERIOD = '1d';

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
	status: PlayerStatus.Pending,
};

export const MESSAGE_START_TOURNAMENT = 'st';
export const MESSAGE_ACCEPT = 'a';
export const MESSAGE_START = 's';
export const MESSAGE_PAUSE = 'p';
export const MESSAGE_QUIT = 'q';
export const MESSAGE_MOVE = 'm';
export const MESSAGE_GAME_STATE = 'g';
export const MESSAGE_POINT = 'x';
export const MESSAGE_FINISH = 'f';

export const MATCH_START_MESSAGE: Message = { t: MESSAGE_START };
export const TOURNAMENT_QUIT_MESSAGE: Message = { t: MESSAGE_QUIT };

export const DEFAULT_DATABASE_PATH = 'database/storage/transcendence.db';

export const DEFAULT_MAX_SCORE = 3;
