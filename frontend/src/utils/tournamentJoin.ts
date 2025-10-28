import { z } from 'zod';
import { TournamentType } from '../../../shared/enums.js';
import {
	CreateTournamentApiSchema,
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { apiCall } from './apiCall';
import { join } from 'path';

type TournamentJoinResult =
	| { success: true; waiting?: boolean; tournament?: any }
	| { success: false; error: string; zodError?: z.ZodError };

export async function joinTournament(
	targetSize: number,
	type: TournamentType
): Promise<TournamentJoinResult> {
	const joinData = {
		size: targetSize,
		type: type,
		alias: sessionStorage.getItem('alias'),
	};

	const parseInput = JoinTournamentSchema.safeParse(joinData);
	if (!parseInput.success) {
		return {
			success: false,
			error: 'Invalid alias. Must be 3-20 characters.',
			zodError: parseInput.error,
		};
	}

	console.debug('Sending to POST /tournaments/join:', joinData);
	const { data: playerQueue, error } = await apiCall(
		'POST',
		'/tournaments/join',
		TournamentQueueSchema,
		joinData
	);

	if (error) {
		return {
			success: false,
			error: `Error ${error.status}: ${error.statusText}, ${error.message}`,
		};
	}

	if (!playerQueue) {
		return {
			success: false,
			error: 'No response from tournament join',
		};
	}

	// Handle player queue
	console.log('Tournament (game) actual players:', playerQueue.queue);
	const currentPlayers = playerQueue.queue.length;
	const isTournamentReady = currentPlayers === targetSize;

	sessionStorage.setItem('thisPlayer', currentPlayers.toString());
	sessionStorage.setItem('targetSize', targetSize.toString());
	sessionStorage.setItem('gameMode', 'remote');

	if (isTournamentReady) {
		console.debug('Tournament (game) actual players:', playerQueue.queue);

		return await createTournament(type, playerQueue);
	}

	return {
		success: true,
		waiting: true,
	};
}

export async function createTournament(
	type: TournamentType,
	playerQueue: any
): Promise<TournamentJoinResult> {
	const body = {
		type: type,
		creator: sessionStorage.getItem('userID') || '',
		participants: playerQueue.queue,
	};

	const parseInput = CreateTournamentApiSchema.safeParse(body);
	if (!parseInput.success) {
		return {
			success: false,
			error: 'Invalid tournament creation data',
			zodError: parseInput.error,
		};
	}

	console.log('Sending to POST /tournaments:', body);
	const { data: tournament, error } = await apiCall(
		'POST',
		'/tournaments',
		TournamentSchema,
		body
	);

	if (error) {
		await leaveTournament();
		return {
			success: false,
			error: `Error ${error.status}: ${error.statusText}, ${error.message}`,
		};
	}

	if (tournament) {
		console.info('Tournament created with ID:', tournament.id);
		sessionStorage.setItem('tournamentID', tournament.id);
		return {
			success: true,
			tournament,
		};
	}

	// await leaveTournament();
	return {
		success: false,
		error: 'Failed to create tournament',
	};
}

export async function leaveTournament(): Promise<void> {
	console.debug('POST /tournaments/leave');
	const { error } = await apiCall('POST', '/tournaments/leave');
	if (error) {
		console.error('Error leaving tournament:', error);
	}
}

export async function replayTournament(
	playerQueue: any
): Promise<TournamentJoinResult> {
	const typeString = sessionStorage.getItem('tournamentType');
	if (!typeString) {
		return {
			success: false,
			error: 'Tournament type missing',
		};
	}
	let typeTourn: TournamentType;
	typeString == '0'
		? (typeTourn = TournamentType.Regular)
		: (typeTourn = TournamentType.Powerup);
	const body = {
		type: typeTourn,
		creator: sessionStorage.getItem('userID') || '',
		participants: playerQueue.queue,
	};

	const parseInput = CreateTournamentApiSchema.safeParse(body);
	if (!parseInput.success) {
		return {
			success: false,
			error: 'Invalid tournament creation data',
			zodError: parseInput.error,
		};
	}
	console.log('Sending to POST /tournaments/replay:', body);
	const { data: tournament, error } = await apiCall(
		'POST',
		'/tournaments/replay',
		TournamentSchema,
		body
	);
	if (error) {
		return {
			success: false,
			error: `Error ${error.status}: ${error.statusText}, ${error.message}`,
		};
	}
	if (tournament) {
		console.info('Tournament created with ID:', tournament.id);
		sessionStorage.setItem('tournamentID', tournament.id);
		return {
			success: true,
			tournament,
		};
	}
	return {
		success: false,
		error: 'Failed to create tournament',
	};
}
