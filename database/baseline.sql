DROP TABLE IF EXISTS tournament_match;
DROP TABLE IF EXISTS tournament_participant;
DROP TABLE IF EXISTS tournament;
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
	id TEXT PRIMARY KEY DEFAULT (
		lower(substr(hex(randomblob(4)),1,8)) || '-' ||
		lower(substr(hex(randomblob(2)),1,4)) || '-' ||
		'4' || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		lower(hex(randomblob(6)))
	),
	max_score INTEGER
);

CREATE TABLE "user" (
	id TEXT PRIMARY KEY DEFAULT (
		lower(substr(hex(randomblob(4)),1,8)) || '-' ||
		lower(substr(hex(randomblob(2)),1,4)) || '-' ||
		'4' || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		lower(hex(randomblob(6)))
	),
	login TEXT NOT NULL,
	first_name TEXT,
	last_name TEXT,
	email TEXT,
	settings_id TEXT REFERENCES settings(id),
	password_hash TEXT NOT NULL,
	CONSTRAINT unique_user_login UNIQUE (login)
);

CREATE TABLE tournament (
	id TEXT PRIMARY KEY DEFAULT (
		lower(substr(hex(randomblob(4)),1,8)) || '-' ||
		lower(substr(hex(randomblob(2)),1,4)) || '-' ||
		'4' || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		lower(hex(randomblob(6)))
	),
	size INTEGER,
	settings_id TEXT,
	status TEXT CHECK (status IN ('pending', 'in_progress', 'finished'))
);

CREATE TABLE tournament_participant (
	id TEXT PRIMARY KEY DEFAULT (
		lower(substr(hex(randomblob(4)),1,8)) || '-' ||
		lower(substr(hex(randomblob(2)),1,4)) || '-' ||
		'4' || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		lower(hex(randomblob(6)))
	),
	tournament_id TEXT REFERENCES tournament(id),
	user_id TEXT REFERENCES "user"(id),
	alias TEXT,
	CONSTRAINT unique_tournament_user UNIQUE (tournament_id, user_id)
);

CREATE TABLE tournament_match (
	id TEXT PRIMARY KEY DEFAULT (
		lower(substr(hex(randomblob(4)),1,8)) || '-' ||
		lower(substr(hex(randomblob(2)),1,4)) || '-' ||
		'4' || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		substr('89ab', 1 + (abs(random()) % 4), 1) || lower(substr(hex(randomblob(2)),2,3)) || '-' ||
		lower(hex(randomblob(6)))
	),
	tournament_id TEXT REFERENCES tournament(id),
	tournament_round INTEGER,
	participant_1_id TEXT REFERENCES tournament_participant(id),
	participant_2_id TEXT REFERENCES tournament_participant(id),
	participant_1_score INTEGER,
	participant_2_score INTEGER,
	status TEXT CHECK (status IN ('pending', 'in_progress', 'finished')),
	CONSTRAINT check_different_participants CHECK (
		participant_1_id != participant_2_id
	)
);

-- Ensure match participants belong to the same tournament

DROP TRIGGER IF EXISTS validate_same_tournament_insert;
CREATE TRIGGER validate_same_tournament_insert
BEFORE INSERT ON tournament_match
FOR EACH ROW
WHEN NEW.participant_1_id IS NOT NULL AND NEW.participant_2_id IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'Both participants must belong to the same tournament')
	WHERE NOT EXISTS (
		SELECT 1
		FROM tournament_participant
		WHERE tournament_id = NEW.tournament_id
		AND id = NEW.participant_1_id
	)
	OR NOT EXISTS (
		SELECT 1
		FROM tournament_participant
		WHERE tournament_id = NEW.tournament_id
		AND id = NEW.participant_2_id
	);
END;

DROP TRIGGER IF EXISTS validate_same_tournament_update;
CREATE TRIGGER validate_same_tournament_update
BEFORE UPDATE ON tournament_match
FOR EACH ROW
WHEN NEW.participant_1_id IS NOT NULL AND NEW.participant_2_id IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'Both participants must belong to the same tournament')
	WHERE NOT EXISTS (
		SELECT 1
		FROM tournament_participant
		WHERE tournament_id = NEW.tournament_id
		AND id = NEW.participant_1_id
	)
	OR NOT EXISTS (
		SELECT 1
		FROM tournament_participant
		WHERE tournament_id = NEW.tournament_id
		AND id = NEW.participant_2_id
	);
END;
