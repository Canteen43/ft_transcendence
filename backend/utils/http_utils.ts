'use strict';

import z from 'zod';

export function getHttpResponse({
	response,
	params,
	body,
	code = 200,
}: {
	params?: z.ZodType;
	body?: z.ZodType;
	code?: number;
	response?: z.ZodType;
}) {
	const schemaConfig: { [key: string]: any } = {};

	if (response) schemaConfig.response = { [code]: response };
	else schemaConfig.response = { [code]: {} };

	if (params) schemaConfig.params = params;
	if (body) schemaConfig.body = body;

	return { schema: schemaConfig };
}
