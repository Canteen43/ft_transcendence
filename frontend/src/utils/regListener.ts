import {
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
import { setMatchData } from './setMatchDataNew';
import { webSocket } from './WebSocketWrapper';

// TODO: add logic for the Quit event?
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
				const tournData = await apiCall(
					'GET',
					`/tournaments/${msg.d}`,
					FullTournamentSchema
				);
				if (tournData) {
					console.log('Tournament data received:', tournData);
					setMatchData(tournData);
					// state.storeCurrentMatch();
					// state.printTournament();
				} else {
					console.error(
						'Getting tournament data failed. Sending WS:MESSAGE_QUIT'
					);
					webSocket.send({ t: MESSAGE_QUIT });
					return;
				}
				if (tournData.matches.length === 1) {
					document.dispatchEvent(new Event('gameReady'));
				} else {
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
				location.hash = '#home';
				alert('The game has been quit.');
				// void new TextModal(this.element, 'You have quit the game.');
				break;

			default:
				console.warn('Unexpected websocket message received:', msg);
		}
	} catch (err) {
		console.error('Invalid message received:', event.data, err);
	}
}
