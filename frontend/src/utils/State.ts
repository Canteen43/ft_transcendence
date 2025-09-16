class State {
	public tournamentOngoing: boolean = false;
	public gameOngoing: boolean = false;
	public gameMode: 'local' | 'remote' | null = null;

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
			match0: {
				id: '',
				player1_id: '',
				player2_id: '',
				participant_1_user_id: '',
				participant_2_user_id: '',
			},
			match1: {
				id: '',
				player1_id: '',
				player2_id: '',
				participant_1_user_id: '',
				participant_2_user_id: '',
			},
			match2: {
				id: '',
				player1_id: '',
				player2_id: '',
				participant_1_user_id: '',
				participant_2_user_id: '',
			},
		},
		current_match_id: '',
	};

	///////////////////////////////////////////////////
	// Store tournament data
	storeTournData(tournData: any): void {
		console.log('DEBUG: Entering storeTournData function');

		const matches = tournData.matches;
		const participants = tournData.participants;

		this.tournament.id = tournData.id;
		this.tournament.round = matches[0].tournament_round;
		this.tournament.is_two_player_game = participants.length === 2;

		this.tournament.matches.match0 = {
			id: matches[0].id,
			player1_id: matches[0].participant_1_id,
			player2_id: matches[0].participant_2_id,
			participant_1_user_id: matches[0].participant_1_user_id,
			participant_2_user_id: matches[0].participant_2_user_id,
		};

		if (matches.length > 1) {
			this.tournament.matches.match1 = {
				id: matches[1].id,
				player1_id: matches[1].participant_1_id,
				player2_id: matches[1].participant_2_id,
				participant_1_user_id: matches[1].participant_1_user_id,
				participant_2_user_id: matches[1].participant_2_user_id,
			};
			this.tournament.matches.match2 = {
				id: matches[2].id,
				player1_id: matches[2].participant_1_id,
				player2_id: matches[2].participant_2_id,
				participant_1_user_id: matches[2].participant_1_user_id,
				participant_2_user_id: matches[2].participant_2_user_id,
			};
		}

		// verif same tournID
		// const tournID_0 = sessionStorage.getItem('tournament_id');
		// console.log(`Tournament ID new: ${this.tournament.id || 'Not set'}`);
		// console.log(`Tournament ID session: ${tournID_0 || 'Not set'}`);
		// if (tournID_0 != tournData.id) console.error('Tournament ID mismatch');

		console.log('Tournament data stored and current match determined');
	}

	///////////////////////////////////////////////////
	// session store the current match for this player
	storeCurrentMatch(): void {
		console.log('DEBUG: Entering storeCurrentMatch function');

		sessionStorage.setItem('tournamentID', this.tournament.id);

		sessionStorage.setItem(
			'player1',
			this.tournament.matches.match0.participant_1_user_id
		);
		sessionStorage.setItem(
			'player2',
			this.tournament.matches.match0.participant_2_user_id
		);

		// Case 1: 2 players game - always match0
		if (this.tournament.is_two_player_game) {
			const match = this.tournament.matches.match0;
			sessionStorage.setItem('matchID', match.id);
			if (match.player1_id === this.playerId) {
				sessionStorage.setItem('thisPlayer', '1');
			} else if (match.player2_id === this.playerId) {
				sessionStorage.setItem('thisPlayer', '2');
			}
			return;
		}

		// Case 2: Tournament finale? player in it?
		if (this.tournament.matches.match2.id) {
			sessionStorage.setItem(
				'player3',
				this.tournament.matches.match1.player1_id
			);
			sessionStorage.setItem(
				'player4',
				this.tournament.matches.match1.player2_id
			);

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
	// Helper print
	printTournament(): void {
		console.log('=== TOURNAMENT STATUS ===');
		console.log(`Tournament ID: ${this.tournament.id || 'Not set'}`);
		console.log(`Tournament Ongoing: ${this.tournamentOngoing}`);
		console.log(`Current Round: ${this.tournament.round}`);
		console.log(`Two Player Game: ${this.tournament.is_two_player_game}`);
		console.log(
			`Current Match ID: ${this.tournament.current_match_id || 'None'}`
		);

		console.log('\n--- MATCHES ---');
		Object.entries(this.tournament.matches).forEach(([matchKey, match]) => {
			const isCurrentMatch =
				match.id === this.tournament.current_match_id;
			const status = isCurrentMatch ? ' [CURRENT]' : '';

			console.log(`${matchKey.toUpperCase()}${status}:`);
			console.log(`  Match ID: ${match.id || 'Not set'}`);
			console.log(`  Player 1: ${match.player1_id || 'TBD'}`);
			console.log(`  Player 2: ${match.player2_id || 'TBD'}`);
			console.log('');
		});

		console.log('--- GAME STATUS ---');
		console.log(`Game Ongoing: ${this.gameOngoing}`);
		console.log(`Current Player ID: ${this.playerId || 'Not set'}`);

		console.log('\n--- DEBUG INFO ---');
		console.log(`Normal Game Ready: ${this.normalGameReady}`);
		console.log(`Started Button Pressed: ${this.startedButtonPressed}`);
		console.log('========================\n');
	}

	///////////////////////////////////////////////////
	// Clear all data
	clear(): void {
		console.log('DEBUG: Entering clear function');

		this.tournamentOngoing = false;
		this.gameOngoing = false;
		this.normalGameReady = false;
		this.startedButtonPressed = false;
		this.tournament = {
			id: '',
			round: 0,
			is_two_player_game: false,
			matches: {
				match0: {
					id: '',
					player1_id: '',
					player2_id: '',
					participant_1_user_id: '',
					participant_2_user_id: '',
				},
				match1: {
					id: '',
					player1_id: '',
					player2_id: '',
					participant_1_user_id: '',
					participant_2_user_id: '',
				},
				match2: {
					id: '',
					player1_id: '',
					player2_id: '',
					participant_1_user_id: '',
					participant_2_user_id: '',
				},
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
