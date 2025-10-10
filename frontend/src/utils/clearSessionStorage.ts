export function clearRemoteData() {
	sessionStorage.removeItem('matchID');
	sessionStorage.removeItem('thisPlayer');
	sessionStorage.removeItem('player1');
	sessionStorage.removeItem('player2');
	sessionStorage.removeItem('alias1');
	sessionStorage.removeItem('alias2');
}

export function clearPowerUps() {
	sessionStorage.removeItem('split');
	sessionStorage.removeItem('stretch');
	sessionStorage.removeItem('shrink');
}

export function clearOtherGameData() {
	sessionStorage.removeItem('targetSize');
	sessionStorage.removeItem('tournamentID');
	sessionStorage.removeItem('gameMode');
	sessionStorage.removeItem('playerCount');
	sessionStorage.setItem('tournament', '0');
}

export function clearLocalGameData() {
	sessionStorage.removeItem('playerCount');
	sessionStorage.removeItem('split');
	sessionStorage.removeItem('stretch');
	sessionStorage.removeItem('shrink');
	sessionStorage.removeItem('alias1controls');
	sessionStorage.removeItem('alias2controls');
	sessionStorage.removeItem('alias3controls');
	sessionStorage.removeItem('alias4controls');
	sessionStorage.removeItem('tournamentSeedAlias1');
	sessionStorage.removeItem('tournamentSeedAlias2');
	sessionStorage.removeItem('tournamentSeedAlias3');
	sessionStorage.removeItem('tournamentSeedAlias4');
}


export function clearTournData() {
	sessionStorage.removeItem('p1');
	sessionStorage.removeItem('p2');
	sessionStorage.removeItem('p3');
	sessionStorage.removeItem('p4');
	sessionStorage.removeItem('w1');
	sessionStorage.removeItem('w2');
	sessionStorage.removeItem('winner');
	sessionStorage.removeItem('p1Score');
	sessionStorage.removeItem('p2Score');
	sessionStorage.removeItem('p3Score');
	sessionStorage.removeItem('p4Score');
	sessionStorage.removeItem('w1Score');
	sessionStorage.removeItem('w2Score');
}

export function clearAllGameData() {
	sessionStorage.removeItem('tournamentID');
	sessionStorage.removeItem('matchID');
	sessionStorage.removeItem('gameMode');
	sessionStorage.setItem('tournament', '0');
	sessionStorage.removeItem('targetSize');
	sessionStorage.removeItem('playerCount');
	sessionStorage.removeItem('thisPlayer');
	sessionStorage.removeItem('player1');
	sessionStorage.removeItem('player2');
	sessionStorage.removeItem('alias1');
	sessionStorage.removeItem('alias2');
	sessionStorage.removeItem('split');
	sessionStorage.removeItem('stretch');
	sessionStorage.removeItem('shrink');
	sessionStorage.removeItem('split');
	sessionStorage.removeItem('stretch');
	sessionStorage.removeItem('shrink');
	sessionStorage.removeItem('alias1controls');
	sessionStorage.removeItem('alias2controls');
	sessionStorage.removeItem('alias3controls');
	sessionStorage.removeItem('alias4controls');
	sessionStorage.removeItem('tournamentSeedAlias1');
	sessionStorage.removeItem('tournamentSeedAlias2');
	sessionStorage.removeItem('tournamentSeedAlias3');
	sessionStorage.removeItem('tournamentSeedAlias4');
}
