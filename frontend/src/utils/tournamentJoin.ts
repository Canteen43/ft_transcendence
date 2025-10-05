import { z } from 'zod';
import {
	CreateTournamentApiSchema,
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { apiCall } from './apiCall';

type TournamentJoinResult =
	| { success: true; waiting?: boolean; tournament?: any }
	| { success: false; error: string; zodError?: z.ZodError };

export async function joinTournament(
	targetSize: number
): Promise<TournamentJoinResult> {
	const joinData = {
		size: targetSize,
		alias: sessionStorage.getItem('alias'),
	};

	const parseInput = JoinTournamentSchema.safeParse(joinData);
	if (!parseInput.success) {
		return {
			success: false,
			error: 'Invalid tournament format',
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
		return await createTournament(playerQueue);
	}

	return {
		success: true,
		waiting: true,
	};
}

export async function createTournament(
	playerQueue: any
): Promise<TournamentJoinResult> {
	const body = {
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
	const body = {
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

