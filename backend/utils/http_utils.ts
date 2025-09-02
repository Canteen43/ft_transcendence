import z from 'zod';

export function routeConfig({
	response,
	params,
	querystring,
	body,
	code = 200,
	secure = true,
}: {
	params?: z.ZodType;
	querystring?: z.ZodType;
	body?: z.ZodType;
	code?: number;
	response?: z.ZodType;
	secure?: boolean;
}) {
	const schemaConfig: { [key: string]: any } = {};

	if (response) schemaConfig.response = { [code]: response };
	else schemaConfig.response = { [code]: {} };

	if (params) schemaConfig.params = params;
	if (body) schemaConfig.body = body;
	if (querystring) schemaConfig.querystring = querystring;

	if (!secure) return { schema: schemaConfig, preHandler: [] };
	return { schema: schemaConfig };
}
