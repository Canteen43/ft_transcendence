import { DEFAULT_MAX_SCORE } from '../../../shared/constants';
import { TextModal } from '../modals/TextModal';
import { router } from '../utils/Router';
import { clearMatchData, clearTournData } from './cleanSessionStorage';

export function updateTournData(tournData: any): void {
	console.debug('updating the match details for the ongoing tournament...');

	const userID = sessionStorage.getItem('userID');
	if (!userID) {
		console.error('No user ID found in session storage');
		new TextModal(
			router.currentScreen!.element,
			'User session expired. Please log in again.'
		);
		return;
	}

	const isTourn = tournData.matches.length > 1;

	console.debug('userID =', userID);
	console.debug('isTourn =', isTourn);
	console.debug('tournData =', tournData);

	clearMatchData();
	clearTournData();

	// Helper function to get alias from user_id
	const getAliasFromUserId = (userId: string): string | null => {
		const participant = tournData.participants.find(
			(p: any) => p.user_id === userId
		);
		return participant ? participant.alias : null;
	};

	//////////////////
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

		// Store scores for display
		const p1Score = tournData.matches[0].participant_1_score || 0;
		const p2Score = tournData.matches[0].participant_2_score || 0;
		sessionStorage.setItem('p1Score', p1Score.toString());
		sessionStorage.setItem('p2Score', p2Score.toString());

		console.debug('DEBUG: Two player game - matchID set to:', matchID);
	}

	//////////////////
	// Tournament mode
	else if (isTourn) {
		// for tournament SCREEN : aliases
		const tournPlyr1 = tournData.matches[0].participant_1_user_id;
		const tournPlyr2 = tournData.matches[0].participant_2_user_id;
		const tournPlyr3 = tournData.matches[1].participant_1_user_id;
		const tournPlyr4 = tournData.matches[1].participant_2_user_id;

		const tournPlyr1Alias = getAliasFromUserId(tournPlyr1);
		const tournPlyr2Alias = getAliasFromUserId(tournPlyr2);
		const tournPlyr3Alias = getAliasFromUserId(tournPlyr3);
		const tournPlyr4Alias = getAliasFromUserId(tournPlyr4);

		sessionStorage.setItem('p1', tournPlyr1Alias || tournPlyr1);
		sessionStorage.setItem('p2', tournPlyr2Alias || tournPlyr2);
		sessionStorage.setItem('p3', tournPlyr3Alias || tournPlyr3);
		sessionStorage.setItem('p4', tournPlyr4Alias || tournPlyr4);

		// Store scores for all matches
		const match0Score1 = tournData.matches[0].participant_1_score || 0;
		const match0Score2 = tournData.matches[0].participant_2_score || 0;
		const match1Score1 = tournData.matches[1].participant_1_score || 0;
		const match1Score2 = tournData.matches[1].participant_2_score || 0;
		
		sessionStorage.setItem('p1Score', match0Score1.toString());
		sessionStorage.setItem('p2Score', match0Score2.toString());
		sessionStorage.setItem('p3Score', match1Score1.toString());
		sessionStorage.setItem('p4Score', match1Score2.toString());

		// Store final match scores if they exist
		if (tournData.matches[2]) {
			const match2Score1 = tournData.matches[2].participant_1_score || 0;
			const match2Score2 = tournData.matches[2].participant_2_score || 0;
			sessionStorage.setItem('w1Score', match2Score1.toString());
			sessionStorage.setItem('w2Score', match2Score2.toString());
		}

		const match0_finished =
			tournData.matches[0].participant_1_score == DEFAULT_MAX_SCORE ||
			tournData.matches[0].participant_2_score == DEFAULT_MAX_SCORE;
		const match1_finished =
			tournData.matches[1].participant_1_score == DEFAULT_MAX_SCORE ||
			tournData.matches[1].participant_2_score == DEFAULT_MAX_SCORE;
		const match2_finished =
				tournData.matches[2].participant_1_score == DEFAULT_MAX_SCORE ||
				tournData.matches[2].participant_2_score == DEFAULT_MAX_SCORE;

		if (match0_finished) {
			const winner1UserId =
				tournData.matches[0].participant_1_score == DEFAULT_MAX_SCORE
					? tournData.matches[0].participant_1_user_id
					: tournData.matches[0].participant_2_user_id;
			const winner1Alias = getAliasFromUserId(winner1UserId);
			sessionStorage.setItem('w1', winner1Alias || winner1UserId);
		} else {
			sessionStorage.setItem('w1', 'Winner 1');
		}

		if (match1_finished) {
			const winner2UserId =
				tournData.matches[1].participant_1_score == DEFAULT_MAX_SCORE
					? tournData.matches[1].participant_1_user_id
					: tournData.matches[1].participant_2_user_id;
			const winner2Alias = getAliasFromUserId(winner2UserId);
			sessionStorage.setItem('w2', winner2Alias || winner2UserId);
		} else {
			sessionStorage.setItem('w2', 'Winner 2');
		}

		if (match2_finished) {
			const tournamentwinnerUserId =
				tournData.matches[2].participant_1_score == DEFAULT_MAX_SCORE
					? tournData.matches[2].participant_1_user_id
					: tournData.matches[2].participant_2_user_id;
			const tournWinnerAlias = getAliasFromUserId(tournamentwinnerUserId);
			sessionStorage.setItem(
				'winner',
				tournWinnerAlias || tournamentwinnerUserId
			);
			sessionStorage.setItem('tournament', '0');
		}

		// Tournament first round
		if (!tournData.matches[2].participant_1_user_id) {
			if (
				(userID == tournPlyr1 || userID == tournPlyr2) &&
				!match0_finished
			) {
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

				console.debug(
					'DEBUG: Tournament first round - match0 - matchID set to:',
					matchID
				);
			} else if (
				(userID == tournPlyr3 || userID == tournPlyr4) &&
				!match1_finished
			) {
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

				console.debug(
					'DEBUG: Tournament first round - match1 - matchID set to:',
					matchID
				);
			} else {
				// User's match is finished or user is waiting
				console.debug('DEBUG: User waiting or match finished');
			}
		}
		// Tournament finale
		else if (!match2_finished) {
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

				console.log(
					'DEBUG: Tournament finale - matchID set to:',
					matchID
				);
			} else {
				console.log('DEBUG: User not in finale match');
				// User is not in the finale
			}
		}
	} else {
		console.error('No game ongoing, no tournament ongoing.');
	}

	console.log(
		'DEBUG: updated current sessionStorage matchID:',
		sessionStorage.getItem('matchID')
	);
	console.log('DEBUG: Tournament display data:', {
		p1: sessionStorage.getItem('p1'),
		p2: sessionStorage.getItem('p2'),
		p3: sessionStorage.getItem('p3'),
		p4: sessionStorage.getItem('p4'),
		w1: sessionStorage.getItem('w1'),
		w2: sessionStorage.getItem('w2'),
		winner: sessionStorage.getItem('winner'),
		scores: {
			p1Score: sessionStorage.getItem('p1Score'),
			p2Score: sessionStorage.getItem('p2Score'),
			p3Score: sessionStorage.getItem('p3Score'),
			p4Score: sessionStorage.getItem('p4Score'),
			w1Score: sessionStorage.getItem('w1Score'),
			w2Score: sessionStorage.getItem('w2Score'),
		}
	});
}