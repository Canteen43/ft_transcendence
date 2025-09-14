class State {
	public tournamentOngoing: boolean = false;
	public gameOngoing: boolean = false;

	// debug variables
	public normalGameReady: boolean = false;
	public startedButtonPressed: boolean = false;

	public playerId: string = '';

	// Tournament state
	public tournament = {
		id: '',
		round: 0,
		is_two_player_game: false,
		matches: {
			match0: { id: '', player1_id: '', player2_id: '' },
			match1: { id: '', player1_id: '', player2_id: '' },
			match2: { id: '', player1_id: '', player2_id: '' },
		},
		current_match_id: '',
	};

	///////////////////////////////////////////////////
	// Store tournament data
	storeTournData(tournData: any): void {
		const matches = tournData.matches;
		const participants = tournData.participants;

		this.tournament.id = tournData.id;
		this.tournament.round = matches[0].tournament_round;
		this.tournament.is_two_player_game = participants.length === 2;

		this.tournament.matches.match0 = {
			id: matches[0].id,
			player1_id: matches[0].participant_1_id,
			player2_id: matches[0].participant_2_id,
		};

		if (matches.length > 1) {
			this.tournament.matches.match1 = {
				id: matches[1].id,
				player1_id: matches[1].participant_1_id,
				player2_id: matches[1].participant_2_id,
			};
			this.tournament.matches.match2 = {
				id: matches[2].id,
				player1_id: matches[2].participant_1_id,
				player2_id: matches[2].participant_2_id,
			};
		}

		// verif same tournID
		const tournID_0 = sessionStorage.getItem('tournament_id');
		if (tournID_0 != tournData.id)
			console.error('Tournament ID mismatch');

		console.log('Tournament data stored and current match determined');
	}

	///////////////////////////////////////////////////
	// session store the current match for this player
	storeCurrentMatch(): void {
		// Case 1: 2 players game - always match0
		if (this.tournament.is_two_player_game) {
			const match = this.tournament.matches.match0;
			sessionStorage.setItem('matchID', match.id);
			if (match.player1_id === this.playerId) {
				sessionStorage.setItem('thisPlayer', '1');
			} else if (match.player2_id === this.playerId) {
				sessionStorage.setItem('thisPlayer', '2');
			}

			sessionStorage.setItem('player1', this.tournament.matches.match0.player1_id);
			sessionStorage.setItem('player2', this.tournament.matches.match0.player2_id);
			return;


		}

		// Case 2: Tournament finale? player in it?
		if (this.tournament.matches.match2.id) {

			sessionStorage.setItem('player3', this.tournament.matches.match1.player1_id);
			sessionStorage.setItem('player4', this.tournament.matches.match1.player2_id);

			if (
				this.tournament.matches.match2.player1_id === this.playerId ||
				this.tournament.matches.match2.player2_id === this.playerId
			) {
				const match = this.tournament.matches.match2;
				sessionStorage.setItem('matchID', match.id);
				if (match.player1_id === this.playerId) {
					sessionStorage.setItem('thisPlayer', '1');
				} else {
					sessionStorage.setItem('thisPlayer', '2');
				}
			} else {
				sessionStorage.removeItem('matchID');
				sessionStorage.removeItem('thisPlayer');
			}
			return;
		}

		// Case 3: Tournament first round
		for (const matchKey of ['match0', 'match1'] as const) {
			const match = this.tournament.matches[matchKey];

			if (
				match.player1_id === this.playerId ||
				match.player2_id === this.playerId
			) {
				sessionStorage.setItem('matchID', match.id);
				if (match.player1_id === this.playerId) {
					sessionStorage.setItem('thisPlayer', '1');
				} else {
					sessionStorage.setItem('thisPlayer', '2');
				}
				return;
			}
		}
	}

	///////////////////////////////////////////////////
	// Clear all data
	clear(): void {
		this.tournamentOngoing = false;
		this.gameOngoing = false;
		this.normalGameReady = false;
		this.startedButtonPressed = false;
		this.tournament = {
			id: '',
			round: 0,
			is_two_player_game: false,
			matches: {
				match0: { id: '', player1_id: '', player2_id: '' },
				match1: { id: '', player1_id: '', player2_id: '' },
				match2: { id: '', player1_id: '', player2_id: '' },
			},
			current_match_id: '',
		};

		this.playerId = '';

		// Clear sessionStorage
		sessionStorage.removeItem('tournament_id');
		sessionStorage.removeItem('matchID');
		sessionStorage.removeItem('thisPlayer');
		sessionStorage.removeItem('id');
		sessionStorage.removeItem('player1');
		sessionStorage.removeItem('player2');
		sessionStorage.removeItem('player3');
		sessionStorage.removeItem('player4');
	}
}

export const state = new State();
