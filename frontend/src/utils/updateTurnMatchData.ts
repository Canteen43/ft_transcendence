export function updateTournamentMatchData(tournData: any): void {
	console.debug('updating the match details for the ongoing tournament...');

	const userID = sessionStorage.getItem('userID');
	const isTourn = tournData.matches.length > 1;

	console.debug('userID =', userID);
	console.debug('isTourn =', isTourn);
	console.debug('tournData =', tournData);

	// Helper function to get alias from user_id
	const getAliasFromUserId = (userId: string): string | null => {
		const participant = tournData.participants.find(
			(p: any) => p.user_id === userId
		);
		return participant ? participant.alias : null;
	};

	// Two player game
	if (!isTourn) {
		const player1 = tournData.matches[0].participant_1_user_id;
		const player2 = tournData.matches[0].participant_2_user_id;
		const player1Alias = getAliasFromUserId(player1);
		const player2Alias = getAliasFromUserId(player2);
		const matchID = tournData.matches[0].id;
		const thisPlayer = userID == player1 ? '1' : '2';

		sessionStorage.setItem('thisPlayer', thisPlayer);
		sessionStorage.setItem('matchID', matchID);
		sessionStorage.setItem('player1', player1);
		sessionStorage.setItem('player2', player2);
		sessionStorage.setItem('alias1', player1Alias || player1);
		sessionStorage.setItem('alias2', player2Alias || player2);

		console.debug('DEBUG: Two player game - matchID set to:', matchID);
	}
	// Tournament mode
	else {
		const match0_finished =
			tournData.matches[0].participant_1_score == 10 ||
			tournData.matches[0].participant_2_score == 10;
		const match1_finished =
			tournData.matches[1].participant_1_score == 10 ||
			tournData.matches[1].participant_2_score == 10;

		// Tournament first round
		if (!tournData.matches[2].participant_1_user_id) {
			const tournPlyr1 = tournData.matches[0].participant_1_user_id;
			const tournPlyr2 = tournData.matches[0].participant_2_user_id;
			const tournPlyr3 = tournData.matches[1].participant_1_user_id;
			const tournPlyr4 = tournData.matches[1].participant_2_user_id;

			// Get aliases for all tournament players
			const tournPlyr1Alias = getAliasFromUserId(tournPlyr1);
			const tournPlyr2Alias = getAliasFromUserId(tournPlyr2);
			const tournPlyr3Alias = getAliasFromUserId(tournPlyr3);
			const tournPlyr4Alias = getAliasFromUserId(tournPlyr4);

			// Store aliases for tournament screen display (p1-p4)
			sessionStorage.setItem('p1', tournPlyr1Alias || tournPlyr1);
			sessionStorage.setItem('p2', tournPlyr2Alias || tournPlyr2);
			sessionStorage.setItem('p3', tournPlyr3Alias || tournPlyr3);
			sessionStorage.setItem('p4', tournPlyr4Alias || tournPlyr4);

			if ((userID == tournPlyr1 || userID == tournPlyr2) && !match0_finished) {
				const matchID = tournData.matches[0].id;
				const thisPlayer = userID == tournPlyr1 ? '1' : '2';
				const player1 = tournPlyr1;
				const player2 = tournPlyr2;

				sessionStorage.setItem('thisPlayer', thisPlayer);
				sessionStorage.setItem('matchID', matchID);
				sessionStorage.setItem('player1', player1);
				sessionStorage.setItem('player2', player2);
				sessionStorage.setItem('alias1', tournPlyr1Alias || player1);
				sessionStorage.setItem('alias2', tournPlyr2Alias || player2);

				console.debug('DEBUG: Tournament first round - match0 - matchID set to:', matchID);
			} else if ((userID == tournPlyr3 || userID == tournPlyr4) && !match1_finished) {
				const matchID = tournData.matches[1].id;
				const thisPlayer = userID == tournPlyr3 ? '1' : '2';
				const player1 = tournPlyr3;
				const player2 = tournPlyr4;

				sessionStorage.setItem('thisPlayer', thisPlayer);
				sessionStorage.setItem('matchID', matchID);
				sessionStorage.setItem('player1', player1);
				sessionStorage.setItem('player2', player2);
				sessionStorage.setItem('alias1', tournPlyr3Alias || player1);
				sessionStorage.setItem('alias2', tournPlyr4Alias || player2);

				console.debug('DEBUG: Tournament first round - match1 - matchID set to:', matchID);
			} else {
				// User's match is finished or user is waiting
				sessionStorage.removeItem('thisPlayer');
				sessionStorage.removeItem('matchID');
				sessionStorage.removeItem('player1');
				sessionStorage.removeItem('player2');
				sessionStorage.removeItem('alias1');
				sessionStorage.removeItem('alias2');
			}
		}
		// Tournament finale
		else {
			const tournPlyr5 = tournData.matches[2].participant_1_user_id;
			const tournPlyr6 = tournData.matches[2].participant_2_user_id;

			if (userID == tournPlyr5 || userID == tournPlyr6) {
				const matchID = tournData.matches[2].id;
				const thisPlayer = userID == tournPlyr5 ? '1' : '2';
				const player1 = tournData.matches[2].participant_1_user_id;
				const player2 = tournData.matches[2].participant_2_user_id;
				const player1Alias = getAliasFromUserId(player1);
				const player2Alias = getAliasFromUserId(player2);

				sessionStorage.setItem('thisPlayer', thisPlayer);
				sessionStorage.setItem('matchID', matchID);
				sessionStorage.setItem('player1', player1);
				sessionStorage.setItem('player2', player2);
				sessionStorage.setItem('alias1', player1Alias || player1);
				sessionStorage.setItem('alias2', player2Alias || player2);

				console.log('DEBUG: Tournament finale - matchID set to:', matchID);
			} else {
				console.log('DEBUG: User not in finale match');
				// User is not in the finale, clear their match data
				sessionStorage.removeItem('matchID');
				sessionStorage.removeItem('thisPlayer');
				sessionStorage.removeItem('player1');
				sessionStorage.removeItem('player2');
				sessionStorage.removeItem('alias1');
				sessionStorage.removeItem('alias2');
			}
		}
	}

	console.log('DEBUG: Final sessionStorage matchID:', sessionStorage.getItem('matchID'));
}