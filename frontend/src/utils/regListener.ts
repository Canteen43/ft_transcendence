import {
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';
import { FullTournamentSchema } from '../../../shared/schemas/tournament';
import { apiCall } from '../utils/apiCall';
import { StorageManager } from './StorageManager';



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
			// send DOM event gameReady => triggers ready button
			case MESSAGE_START_TOURNAMENT:
				console.info('Received "st":', msg);
				if (msg.d) {
					console.log('Storing tournament ID:', msg.d);
					sessionStorage.setItem('tournamentId', msg.d);
				} else {
					console.error('Tournament ID not found in message.d:', msg);
					return;
				}
				const tournData = await apiCall(
					'GET',
					`/tournaments/${msg.d}`,
					FullTournamentSchema
				);
				if (tournData) {
					console.log('Storing match ID:', tournData);
					StorageManager.storeData(tournData);
					document.dispatchEvent(new Event('gameReady')); // will trigger the READY button
				} else {
					console.error('No tournament data received', tournData);
					return;
				}

				break;

			// s: START MESSSAGE per WS
			// all players have pressed ready for their match
			// send DOM event toGameScreen => move to the game screen
			// will need to destroy the 2 player readymodal
			case MESSAGE_START:
				console.info('Received start message:', msg);
				document.dispatchEvent(new Event('toGameScreen'));
				location.hash = '#game';
				break;

			default:
				console.warn('Unexpected websocket message received:', msg);
		}
	} catch (err) {
		console.error('Invalid message received:', event.data, err);
	}
}
