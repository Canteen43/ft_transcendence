export function setMatchData(tournData: any): void {

	const userID = sessionStorage.getItem('userID');
	const isTourn = (tournData.matches.length > 1);

	console.debug('userID =', userID);
	console.debug('isTourn =', isTourn);
	console.debug('tournData =', tournData);

	// Helper function to get alias from user_id
	const getAliasFromUserId = (userId: string): string | null => {
		const participant = tournData.participants.find((p: any) => p.user_id === userId);
		return participant ? participant.alias : null;
	};

	// Two player game
	if (!isTourn) {
		const player1 = tournData.matches[0].participant_1_user_id;
		const player2 = tournData.matches[0].participant_2_user_id;
		const player1Alias = getAliasFromUserId(player1);
		const player2Alias = getAliasFromUserId(player2);
		const matchID = tournData.matches[0].id;
		const thisPlayer = (userID == player1) ? '1' : '2';

		sessionStorage.setItem('thisPlayer', thisPlayer);
		sessionStorage.setItem('matchID', matchID);
		sessionStorage.setItem('player1', player1);
		sessionStorage.setItem('player2', player2);
		sessionStorage.setItem('alias1', player1Alias || player1);
		sessionStorage.setItem('alias2', player2Alias || player2);
		
		console.debug('DEBUG: Two player game - matchID set to:', matchID);
	}

	// Tournament first round
	else {//if (!tournData.matches[2].participant_1_user_id) {
		const tournPlyr1 = tournData.matches[0].participant_1_user_id;
		const tournPlyr2 = tournData.matches[0].participant_2_user_id;
		const tournPlyr3 = tournData.matches[1].participant_1_user_id;
		const tournPlyr4 = tournData.matches[1].participant_2_user_id;

		// Get aliases for all tournament players
		const tournPlyr1Alias = getAliasFromUserId(tournPlyr1);
		const tournPlyr2Alias = getAliasFromUserId(tournPlyr2);
		const tournPlyr3Alias = getAliasFromUserId(tournPlyr3);
		const tournPlyr4Alias = getAliasFromUserId(tournPlyr4);

		// Store aliases for tournament screen display (ALIAS1-4)
		sessionStorage.setItem('alias1', tournPlyr1Alias || tournPlyr1);
		sessionStorage.setItem('alias2', tournPlyr2Alias || tournPlyr2);
		sessionStorage.setItem('alias3', tournPlyr3Alias || tournPlyr3);
		sessionStorage.setItem('alias4', tournPlyr4Alias || tournPlyr4);
		

		let matchID, thisPlayer, player1, player2, player1Alias, player2Alias;

		if (userID == tournPlyr1 || userID == tournPlyr2) {
			matchID = tournData.matches[0].id;
			thisPlayer = (userID == tournPlyr1) ? '1' : '2';
			player1 = tournPlyr1;
			player2 = tournPlyr2;
			player1Alias = tournPlyr1Alias;
			player2Alias = tournPlyr2Alias;
			
			console.debug('DEBUG: Tournament first round - match0 - matchID set to:', matchID);
		}
		else { 
			matchID = tournData.matches[1].id; 
			thisPlayer = (userID == tournPlyr3) ? '1' : '2';
			player1 = tournPlyr3;
			player2 = tournPlyr4;
			player1Alias = tournPlyr3Alias;
			player2Alias = tournPlyr4Alias;
			
			console.debug('DEBUG: Tournament first round - match1 - matchID set to:', matchID);
		}

		// Store game launch data
		sessionStorage.setItem('thisPlayer', thisPlayer);
		sessionStorage.setItem('matchID', matchID);
		sessionStorage.setItem('player1', player1);
		sessionStorage.setItem('player2', player2);
		sessionStorage.setItem('player1Alias', player1Alias || player1);
		sessionStorage.setItem('player2Alias', player2Alias || player2);
	}
	// else {
	// 	// Tournament finale
	// 	const tournPlyr5 = tournData.matches[2].participant_1_user_id;
	// 	const tournPlyr6 = tournData.matches[2].participant_2_user_id;

	// 	if (userID == tournPlyr5 || userID == tournPlyr6) {
	// 		const matchID = tournData.matches[2].id; 
	// 		const thisPlayer = (userID == tournPlyr5) ? '1' : '2';
	// 		const player1 = tournData.matches[2].participant_1_user_id;
	// 		const player2 = tournData.matches[2].participant_2_user_id;
	// 		const player1Alias = getAliasFromUserId(player1);
	// 		const player2Alias = getAliasFromUserId(player2);

	// 		sessionStorage.setItem('thisPlayer', thisPlayer);
	// 		sessionStorage.setItem('matchID', matchID);
	// 		sessionStorage.setItem('player1', player1);
	// 		sessionStorage.setItem('player2', player2);
	// 		sessionStorage.setItem('player1Alias', player1Alias || player1);
	// 		sessionStorage.setItem('player2Alias', player2Alias || player2);
			
	// 		console.log('DEBUG: Tournament finale - matchID set to:', matchID);
	// 	} else {
	// 		console.log('DEBUG: User not in finale match');
	// 		// User is not in the finale, clear their match data
	// 		sessionStorage.removeItem('matchID');
	// 		sessionStorage.removeItem('thisPlayer');
	// 		sessionStorage.removeItem('player1');
	// 		sessionStorage.removeItem('player2');
	// 		sessionStorage.removeItem('player1Alias');
	// 		sessionStorage.removeItem('player2Alias');
	// 	}
	// }

	console.log('DEBUG: Final sessionStorage matchID:', sessionStorage.getItem('matchID'));
}