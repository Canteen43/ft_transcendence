import { UUID } from '../../shared/types.js';
import { GameSocket } from '../types/interfaces.js';

export class GameService {
	private static instance: GameService;
	private clients = new Set<GameSocket>();

	private constructor() {}

	static getInstance(): GameService {
		if (!this.instance) {
			this.instance = new GameService();
		}
		return this.instance;
	}

	private readonly protocolFunctionMap = {
		c: this.handleCreate,
		s: this.handleStart,
		q: this.handleQuit,
		p: this.handlePause,
		m: this.handleMove,
		a: this.handleAccept,
		d: this.handleDecline,
	} as const;

	handleMessage(connection_id: UUID, message: string) {}
	handleCreate() {}
	handleStart() {}
	handleQuit() {}
	handlePause() {}
	handleMove() {}
	handleAccept() {}
	handleDecline() {}
}
