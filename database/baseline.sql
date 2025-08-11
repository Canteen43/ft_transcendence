DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS tournament;
DROP TABLE IF EXISTS tournament_match;
DROP TABLE IF EXISTS tournament_participant;
DROP TABLE IF EXISTS settings;

DROP TYPE IF EXISTS tournament_status;
DROP TYPE IF EXISTS match_status;
DROP TYPE IF EXISTS participant_status;

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
	'pending'
	'accepted'
);

CREATE TABLE "user" (
	login varchar(128) PRIMARY KEY,
	first_name varchar(128) NULL,
	last_name varchar(128) NULL,
	email varchar(128) NULL,
	password_hash TEXT NULL
);

CREATE TABLE tournament (
	id 				uuid PRIMARY KEY,
	size			int,
	current_round	int,
	settings		uuid,
	status			tournament_status
);

CREATE TABLE tournament_match (
	id					uuid PRIMARY KEY,
	tournament_id		uuid,
	participant_1_id	uuid,
	participant_2_id	uuid,
	participant_1_score	int,
	participant_2_score	int,
	tournament_round	int,
	status				match_status
);

CREATE TABLE tournament_participant (
	id				uuid PRIMARY KEY,
	tournament_id	uuid,
	user_id			uuid,
	status			participant_status,
	CONSTRAINT unique_tournament_user UNIQUE (tournament_id, user_id)
);

CREATE TABLE settings (
	id			uuid PRIMARY KEY,
	max_score	int
);
