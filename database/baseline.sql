DROP TABLE IF EXISTS tournament_match;
DROP TABLE IF EXISTS tournament_participant;
DROP TABLE IF EXISTS tournament;
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS settings;

DROP TYPE IF EXISTS tournament_status;
DROP TYPE IF EXISTS match_status;
DROP TYPE IF EXISTS participant_status;

DROP FUNCTION IF EXISTS validate_same_tournament;

CREATE TYPE tournament_status AS ENUM (
	'pending',
	'in_progress',
	'finished'
);

CREATE TYPE match_status AS ENUM (
	'pending',
	'in_progress',
	'finished'
);

CREATE TYPE participant_status AS ENUM (
	'creator',
	'pending',
	'accepted'
);

CREATE FUNCTION validate_same_tournament(
	p_tournament_id uuid,
	p_participant_1_id uuid,
	p_participant_2_id uuid
) RETURNS boolean AS $$ BEGIN
	IF p_participant_1_id IS NULL OR p_participant_2_id IS NULL THEN
		RETURN TRUE;
	END IF;
	RETURN (
		SELECT COUNT(*) = 2
		FROM tournament_participant
		WHERE tournament_id = p_tournament_id
		AND   id IN (p_participant_1_id, p_participant_2_id)
	);
END;
$$ LANGUAGE plpgsql;

CREATE TABLE settings (
	id			uuid PRIMARY KEY DEFAULT (uuid_generate_v4()),
	max_score	int
);

CREATE TABLE "user" (
	id				uuid PRIMARY KEY DEFAULT (uuid_generate_v4()),
	login			varchar(128) NOT NULL,
	first_name		varchar(128),
	last_name		varchar(128),
	email			varchar(128),
	password_hash	text NOT NULL,
	settings_id		uuid REFERENCES settings(id),
	CONSTRAINT unique_user_login UNIQUE (login)
);

CREATE TABLE tournament (
	id 				uuid PRIMARY KEY DEFAULT (uuid_generate_v4()),
	size			int,
	settings		uuid,
	status			tournament_status
);

CREATE TABLE tournament_participant (
	id				uuid PRIMARY KEY DEFAULT (uuid_generate_v4()),
	tournament_id	uuid REFERENCES tournament(id),
	user_id			uuid REFERENCES "user"(id),
	status			participant_status,
	CONSTRAINT unique_tournament_user UNIQUE (tournament_id, user_id)
);

CREATE TABLE tournament_match (
	id					uuid PRIMARY KEY DEFAULT (uuid_generate_v4()),
	tournament_id		uuid REFERENCES tournament(id),
	tournament_round	int,
	participant_1_id	uuid REFERENCES tournament_participant(id),
	participant_2_id	uuid REFERENCES tournament_participant(id),
	participant_1_score	int,
	participant_2_score	int,
	status				match_status,

	CONSTRAINT check_same_tournament CHECK (
		validate_same_tournament(tournament_id, participant_1_id, participant_2_id)
	),
	CONSTRAINT check_different_participants CHECK (
		participant_1_id != participant_2_id
	)
);

