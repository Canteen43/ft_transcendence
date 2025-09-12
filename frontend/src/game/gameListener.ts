// gameListener.ts
import {
	MESSAGE_ACCEPT,
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
				alert('Quit: ' + JSON.stringify(msg));
				break;

			case MESSAGE_MOVE:
				alert('Move: ' + JSON.stringify(msg));
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
						console.warn(
							'Failed to parse game state JSON string:',
							e
						);
					}
				} else {
					payload = rawPayload;
				}
				console.debug('Game State received:', payload);
				document.dispatchEvent(
					new CustomEvent('remoteGameState', { detail: payload })
				);
				break;

			case MESSAGE_POINT:
				alert('Point: ' + JSON.stringify(msg));
				break;

			default:
				console.warn('Unknown message type:', msg);
		}
	} catch (err) {
		console.error('Invalid message received:', event.data, err);
	}
}
