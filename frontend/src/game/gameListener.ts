// gameListener.ts
import {
	MESSAGE_ACCEPT,
	MESSAGE_FINISH,
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	MESSAGE_REPLAY,
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';

import { FullTournamentSchema } from '../../../shared/schemas/tournament';
import { TextModal } from '../modals/TextModal';
import { GameScreen } from '../screens/GameScreen';
import { apiCall } from '../utils/apiCall';
import {
	clearMatchData,
	clearOtherGameData,
	clearTournData,
} from '../utils/cleanSessionStorage';
import { router } from '../utils/Router';
import { state } from '../utils/State';
import { updateTournData } from '../utils/updateTurnMatchData';
import { webSocket } from '../utils/WebSocketWrapper';
import { conditionalError, conditionalLog, conditionalWarn } from './Logger';


export async function gameListener(event: MessageEvent) {
	try {
		const raw =
			typeof event.data === 'string'
				? JSON.parse(event.data)
				: event.data;
		const msg: Message = MessageSchema.parse(raw);

		switch (msg.t) {
			case MESSAGE_START_TOURNAMENT:
				console.info('Received "st":', msg);
				console.debug('Clearing match data before GET tournament');
				clearMatchData();
				clearTournData();
				sessionStorage.setItem('tournamentID', `${msg.d}`);

				const { data: tournData, error } = await apiCall(
					'GET',
					`/tournaments/${msg.d}`,
					FullTournamentSchema
				);
				if (error) {
					console.error('Tournament join error:', error);
					const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
					new TextModal(
						router.currentScreen!.element,
						message,
						undefined
					);
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
				}
				if (tournData.matches.length === 1) {
					updateTournData(tournData);
					const matchID = sessionStorage.getItem('matchID');
					if (!matchID) {
						new TextModal(
							router.currentScreen!.element,
							'No match ID found'
						);
						console.error('No match ID found in session storage');
						return;
					}
					console.debug({ matchID });
					webSocket.send({ t: MESSAGE_ACCEPT, d: matchID });
				} else {
					console.warn('received ST on game screen-> redir to home');
					new TextModal(
						router.currentScreen!.element,
						'Error: Received data for more than a match'
					);
					location.hash = '#home';
				}
				break;

			case MESSAGE_START:
				console.info('Received start message:', msg);
				state.gameOngoing = true;
				state.gameMode = 'remote';
				location.hash = '#game';
				console.debug('reloading pong.ts');
				(router.currentScreen as GameScreen)?.reloadPong();
				break;

			case MESSAGE_QUIT:
				console.debug('Clearing game data');
				clearMatchData();
				clearTournData();
				clearOtherGameData();
				location.hash = '#home';
				setTimeout(() => {
					void new TextModal(
						router.currentScreen!.element,
						'The game has been quit.'
					);
				}, 100);
				break;
			// TODO : maybe remove the refreshing and redirecting when we are on the game
			// case MESSAGE_FINISH:
			// 	console.info('Received finish message:', msg);
			// 	if (state.gameOngoing = false) {
			// 		console.debug(
			// 			'Received finish, no game ongoing, redirecting to tournament'
			// 		);
			// 		location.hash = '#tournament';
			// 	}

			// 	break;

			case MESSAGE_REPLAY:
				console.debug('Replay received');
				state.replayCounter += 1;
				console.debug('Replay counter:', state.replayCounter);
				if (state.replayCounter === 2) {
					console.debug(
						'Both players ready for replay, dispatching event'
					);
					document.dispatchEvent(new CustomEvent('RemoteReplay'));
				}
				break;

			case MESSAGE_MOVE:
				// Extract player ID and input from the message
				const movePayload =
					(msg as any).d ?? (msg as any).payload ?? msg;
				let moveData;
				if (typeof movePayload === 'string') {
					try {
						moveData = JSON.parse(movePayload);
					} catch (e) {
						conditionalWarn('Failed to parse move JSON string:', e);
						break;
					}
				} else {
					moveData = movePayload;
				}

				// Expect format: { playerId: number, input: { k: number } }
				if (
					moveData &&
					typeof moveData.playerId === 'number' &&
					moveData.input
				) {
					conditionalLog('Move received:', moveData);
					document.dispatchEvent(
						new CustomEvent('remoteMove', { detail: moveData })
					);
				} else {
					conditionalWarn('Invalid move message format:', moveData);
				}
				break;

			case MESSAGE_GAME_STATE:
				// Extract common payload fields; if 'd' is a JSON string parse it back to an object.
				const rawPayload =
					(msg as any).d ??
					(msg as any).payload ??
					(msg as any).data ??
					msg;
				let payload;
				if (typeof rawPayload === 'string') {
					try {
						payload = JSON.parse(rawPayload);
					} catch (e) {
						// fallback to raw string if parsing fails
						payload = rawPayload;
						conditionalWarn(
							'Failed to parse game state JSON string:',
							e
						);
					}
				} else {
					payload = rawPayload;
				}
				conditionalLog('Game State received:', payload);
				document.dispatchEvent(
					new CustomEvent('remoteGameState', { detail: payload })
				);
				break;

			case MESSAGE_POINT:
				// Extract the scoring player's UID from the message
				const scoringPlayerUID = (msg as any).d;
				conditionalLog('🎯 MESSAGE_POINT received:', msg);
				conditionalLog('🎯 Scoring player UID:', scoringPlayerUID);
				conditionalLog('🎯 Full message object:', JSON.stringify(msg));
				if (scoringPlayerUID && typeof scoringPlayerUID === 'string') {
					conditionalLog(
						'Score update received for player UID:',
						scoringPlayerUID
					);
					conditionalLog('🎯 Dispatching remoteScoreUpdate event');
					document.dispatchEvent(
						new CustomEvent('remoteScoreUpdate', {
							detail: { scoringPlayerUID },
						})
					);
					conditionalLog('🎯 remoteScoreUpdate event dispatched');
				} else {
					conditionalWarn(
						'Invalid MESSAGE_POINT format - missing UID:',
						msg
					);
				}
				break;

			default:
				conditionalWarn('Unknown message type:', msg);
		}
	} catch (err) {
		conditionalError('Invalid message received:', event.data, err);
	}
}
