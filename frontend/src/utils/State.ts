class State {
	public tournamentOngoing: boolean = false;
	public gameOngoing: boolean = false;
	public gameMode: 'local' | 'remote' | null = null;
	public playerCount: number = 0;
	public tournamentSize: number = 0;
	public replayCounter: number = 0;
	// debug variables
	// public normalGameReady: boolean = false;
	// public playerId: string = '';
	}

export const state = new State();
