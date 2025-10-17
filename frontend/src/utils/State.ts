import { Modal } from '../modals/Modal';

class State {
	public tournamentOngoing: boolean = false;
	public gameOngoing: boolean = false;
	public gameMode: 'local' | 'remote' | null = null;
	public playerCount: number = 0;
	public tournamentSize: number = 0;
	public replayCounter: number = 0;
	public chatExpanded: boolean = true;
	public currentModal: Modal | null = null;
	public isMobile: boolean = false;
}

export const state = new State();
