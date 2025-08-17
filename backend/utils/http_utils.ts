import { scheduler } from 'timers/promises';
import z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

	if (params) console.log('Final params schema:', schemaConfig.params);

	return { schema: schemaConfig };
}
