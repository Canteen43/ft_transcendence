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
				alert('Game State: ' + JSON.stringify(msg));
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
