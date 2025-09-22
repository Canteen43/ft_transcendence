export function clearMatchData() {
	sessionStorage.removeItem('matchID');
	sessionStorage.removeItem('thisPlayer');
	sessionStorage.removeItem('player1');
	sessionStorage.removeItem('player2');
	sessionStorage.removeItem('alias1');
	sessionStorage.removeItem('alias2');
}

export function clearTournData() {
	sessionStorage.getItem('p1');
	sessionStorage.getItem('p2');
	sessionStorage.getItem('p3');
	sessionStorage.getItem('p4');
	sessionStorage.getItem('w1');
	sessionStorage.getItem('w2');
	sessionStorage.getItem('winner');
	sessionStorage.getItem('tournamentID');
}
