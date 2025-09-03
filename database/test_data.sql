INSERT INTO settings (id, max_score)
VALUES 	('b0dde6bd-135a-4fb5-a71b-2331babae5d4', 3),
		('550e8400-e29b-41d4-a716-446655450001', 3),
		('550e8400-e29b-41d4-a716-446655450002', 3),
		('550e8400-e29b-41d4-a716-446655450003', 3);

INSERT INTO "user" (id, login, first_name, last_name, email, password_hash, settings_id)
VALUES 	('b0dde6bd-135a-4fb5-a71b-2331babae5d3', 'wouter', 'Wouter', 'Pepping', 'wpepping@mail.com', '', 'b0dde6bd-135a-4fb5-a71b-2331babae5d4'),
		('550e8400-e29b-41d4-a716-446655440001', 'karl', 'Karl', 'Weihmann', 'karl@mail.com', 'abc', '550e8400-e29b-41d4-a716-446655450001'),
		('550e8400-e29b-41d4-a716-446655440004', 'karl2', 'Karl', 'Weihmann', 'karl2@mail.com', 'abc', '550e8400-e29b-41d4-a716-446655450001'),
		('550e8400-e29b-41d4-a716-446655440002', 'helene', 'Helene', '', 'helene@mail.com', 'secret', '550e8400-e29b-41d4-a716-446655450002'),
		('550e8400-e29b-41d4-a716-446655440003', 'mark', 'Mark', 'R', 'mark@mail.com', '', '550e8400-e29b-41d4-a716-446655450003');