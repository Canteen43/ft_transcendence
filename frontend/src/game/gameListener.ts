// gameListener.ts
import {
	MESSAGE_ACCEPT,
	MESSAGE_FINISH,
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_PAUSE,
	MESSAGE_POINT,
	MESSAGE_QUIT,
	MESSAGE_START,
	MESSAGE_START_TOURNAMENT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { MessageSchema } from '../../../shared/schemas/message';
import { TextModal } from '../modals/TextModal';
import { router } from '../utils/Router';
import { state } from '../utils/State';
import { conditionalError, conditionalLog, conditionalWarn } from './Logger';

export function gameListener(event: MessageEvent) {
	try {
		const raw =
			typeof event.data === 'string'
				? JSON.parse(event.data)
				: event.data;
		const msg: Message = MessageSchema.parse(raw);

		switch (msg.t) {
			case MESSAGE_START_TOURNAMENT:
				alert('Start Tournament: ' + JSON.stringify(msg));
				break;

			case MESSAGE_ACCEPT:
				alert('Accept: ' + JSON.stringify(msg));
				break;

			case MESSAGE_START:
				alert('Start: ' + JSON.stringify(msg));
				break;

			case MESSAGE_PAUSE:
				alert('Pause: ' + JSON.stringify(msg));
				break;

			case MESSAGE_QUIT:
				// alert('Quit: ' + JSON.stringify(msg));
				location.hash = '#home';
				void new TextModal(
					router.currentScreen!.element,
					'The game has been quit.'
				);
				break;

			case MESSAGE_FINISH:
				alert('Finish: ' + JSON.stringify(msg));
				updateTournamentScreen();
				updateTournamentMatchData();
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
