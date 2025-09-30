import {
	MESSAGE_FINISH,
	MESSAGE_GAME_STATE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';

import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';
import {
	FullTournamentSchema,
	TournamentQueueSchema,
} from '../../../shared/schemas/tournament';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';

import { TextModal } from '../modals/TextModal';
import { router } from './Router';
import { updateTournData } from '../utils/updateTurnMatchData.js';
import { webSocket } from './WebSocketWrapper';

export async function regListener(event: MessageEvent): Promise<void> {
	try {
		console.log('Processing message in regListener...');

		const raw =
			typeof event.data === 'string'
				? JSON.parse(event.data)
				: event.data;
		const msg: Message = MessageSchema.parse(raw);

		console.log('Validated message:', msg);
		console.log('Message type:', msg.t);

		switch (msg.t) {
			// st: START TOURNAMENT MESSSAGE with tournament id per WS
			// apicall to get the full game / tournament data
			case MESSAGE_START_TOURNAMENT:
				console.info('Received "st":', msg);
				sessionStorage.setItem('tournamentID', `${msg.d}`);

				const { data: tournData, error } = await apiCall(
					'GET',
					`/tournaments/${msg.d}`,
					FullTournamentSchema
				);
				if (error) {
					console.error('Tournament join error:', error);
					const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
					new TextModal(router.currentScreen!.element, message, undefined);
					return;
				}

				if (!tournData) {
					console.error('Getting tournament data failed, QUIT sent');
					webSocket.send({ t: MESSAGE_QUIT });
					new TextModal(
						router.currentScreen!.element,
						'Failed to get tournament data'
					);
					return;

				} else if (tournData.matches.length === 1) {
					updateTournData(tournData);
					document.dispatchEvent(new Event('2plyrsGameReady'));
				} else {
					console.debug(
						'received ST during Tournament-> redir to Tournament'
					);
					location.hash = '#tournament';
				}

				break;

			// s: case MESSAGE_START (all players ready)
			// send DOM event toGameScreen => move to the game screen
			case MESSAGE_START:
				console.info('Received start message:', msg);
				state.gameOngoing = true;
				state.gameMode = 'remote';
				location.hash = '#game';
				break;

			case MESSAGE_QUIT:
				console.info('Received quit message:', msg);
				if (location.hash === '#home') {
					const readyModal = document.querySelector(
						'.ready-modal');
					readyModal?.remove();
				}
				location.hash = '#home';
				new TextModal(
					router.currentScreen!.element,
					'The game has been quit.'
				);
				break;

			case MESSAGE_FINISH:
				console.info('Received finish message:', msg);
				const tourn = sessionStorage.getItem('tournament');
				console.debug({ tourn });
				setTimeout(() => {
					document.dispatchEvent(new Event('tournament-updated'));
				}, 50);
				break;

			default:
				console.warn('Unexpected websocket message received:', msg);
		}
	} catch (err) {
		console.error('Invalid message received:', event.data, err);
		new TextModal(
			router.currentScreen!.element,
			'Received invalid message from server'
		);
	}
}
