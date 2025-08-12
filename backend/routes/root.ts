import type { FastifyInstance, FastifyRequest } from 'fastify';

export const homeRoute = async function (
	request: FastifyRequest
) {
	return { msg: "Hello World" }
}

export default async function (fastify: FastifyInstance, opts: Record<string, any>) {
	fastify.get('/', homeRoute)
}
