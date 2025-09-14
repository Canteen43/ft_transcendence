

export class StorageManager {
	
	static storeData(tournData: any): void {
		const matches = tournData.matches;
		const participants = tournData.participants;
		
		// Determine if it's a 2 or 4 player tournament
		const is_two_player_game = participants.length === 2;
		
		// Store current match (backward compatibility)
		sessionStorage.setItem('matchID', matches[0].id);
		
		// Store match 1 data
		sessionStorage.setItem('match1_id', matches[0].id);
		sessionStorage.setItem('match1_player1_id', matches[0].participant_1_id);
		sessionStorage.setItem('match1_player2_id', matches[0].participant_2_id);
		
		// Store tournament info
		sessionStorage.setItem('tournament_round', matches[0].tournament_round.toString());
		sessionStorage.setItem('tournament_id', tournData.id);
		sessionStorage.setItem('is_two_player_game', is_two_player_game.toString());
		
		// Store additional matches for 4 player tournaments
		if (!is_two_player_game && matches.length >= 2) {
			sessionStorage.setItem('match2_id', matches[1].id);
			sessionStorage.setItem('match2_player1_id', matches[1].participant_1_id);
			sessionStorage.setItem('match2_player2_id', matches[1].participant_2_id);
			
			// Final match (if exists)
			if (matches.length >= 3) {
				sessionStorage.setItem('match3_id', matches[2].id);
				sessionStorage.setItem('match3_player1_id', matches[2].participant_1_id);
				sessionStorage.setItem('match3_player2_id', matches[2].participant_2_id);
			}
		}
		
		console.log('Tournament data stored in sessionStorage');
	}
	
	static getCurrentMatch(): { id: string; player1_id: string; player2_id: string } | null {
		const matchID = sessionStorage.getItem('matchID');
		
		if (!matchID) return null;
		
		// Find which match is current based on matchID
		if (matchID === sessionStorage.getItem('match1_id')) {
			return {
				id: sessionStorage.getItem('match1_id')!,
				player1_id: sessionStorage.getItem('match1_player1_id')!,
				player2_id: sessionStorage.getItem('match1_player2_id')!
			};
		}
		
		if (matchID === sessionStorage.getItem('match2_id')) {
			return {
				id: sessionStorage.getItem('match2_id')!,
				player1_id: sessionStorage.getItem('match2_player1_id')!,
				player2_id: sessionStorage.getItem('match2_player2_id')!
			};
		}
		
		if (matchID === sessionStorage.getItem('match3_id')) {
			return {
				id: sessionStorage.getItem('match3_id')!,
				player1_id: sessionStorage.getItem('match3_player1_id')!,
				player2_id: sessionStorage.getItem('match3_player2_id')!
			};
		}
		
		return null;
	}
	
	static getMatch(matchNumber: 1 | 2 | 3): { id: string; player1_id: string; player2_id: string } | null {
		const id = sessionStorage.getItem(`match${matchNumber}_id`);
		const player1_id = sessionStorage.getItem(`match${matchNumber}_player1_id`);
		const player2_id = sessionStorage.getItem(`match${matchNumber}_player2_id`);
		
		if (!id || !player1_id || !player2_id) return null;
		
		return { id, player1_id, player2_id };
	}
	
	static advanceToNextMatch(): boolean {
		const currentMatchID = sessionStorage.getItem('matchID');
		
		// If currently on match 1, try to advance to match 2
		if (currentMatchID === sessionStorage.getItem('match1_id')) {
			const match2_id = sessionStorage.getItem('match2_id');
			if (match2_id) {
				sessionStorage.setItem('matchID', match2_id);
				return true;
			}
		}
		
		// If currently on match 2, try to advance to match 3
		if (currentMatchID === sessionStorage.getItem('match2_id')) {
			const match3_id = sessionStorage.getItem('match3_id');
			if (match3_id) {
				sessionStorage.setItem('matchID', match3_id);
				return true;
			}
		}
		
		return false; // No more matches
	}
	
	static isTwoPlayerGame(): boolean {
		return sessionStorage.getItem('is_two_player_game') === 'true';
	}
	
	static clear(): void {
		const keys = [
			'matchID', 'tournament_id', 'tournament_round', 'is_two_player_game',
			'match1_id', 'match1_player1_id', 'match1_player2_id',
			'match2_id', 'match2_player1_id', 'match2_player2_id',
			'match3_id', 'match3_player1_id', 'match3_player2_id'
		];
		
		keys.forEach(key => sessionStorage.removeItem(key));
	}
}