export interface Message {
	t: string;
	d?: string;
	l?: number[];
}






player one sends g(ballX, ballZ)
and only while moving m(playerX, playerZ, other)

playerNumber players send (only while moving) (playerNumber, playerX, playerZ)

Server relays all incoming messages to all -other- websockets. 



JSON.stringify(message)


message: Message = {
	t: MESSAGE_GAME_STATE,
	l: [123, 234],
}

message: Message = {
	t: MESSAGE_MOVE,
	d: user_id,
	l: [123, 234],
}


