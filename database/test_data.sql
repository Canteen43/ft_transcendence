INSERT INTO settings (id, max_score)
VALUES 	('b0dde6bd-135a-4fb5-a71b-2331babae5d4', 3),
		('550e8400-e29b-41d4-a716-446655440003', 3);

INSERT INTO "user" (id, login, first_name, last_name, email, password_hash, settings_id)
VALUES 	('b0dde6bd-135a-4fb5-a71b-2331babae5d3', 'wouter', 'Wouter', 'Pepping', 'wpepping@mail.com', '', 'b0dde6bd-135a-4fb5-a71b-2331babae5d4'),
		('550e8400-e29b-41d4-a716-446655440002', 'karl', 'Karl', 'Weihmann', 'karl@mail.com', '', '550e8400-e29b-41d4-a716-446655440003');


