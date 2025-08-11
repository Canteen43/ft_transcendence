import UserRepository from '../repositories/user_repository.js'
import type * as fastify from 'fastify'

const homeRoute = async function (
	request: fastify.FastifyRequest
) {
	return { msg: "Hello World" }
}

const userRoute = async function (
	request: fastify.FastifyRequest<{ Params: { login: string } }>,
) {
	return UserRepository.getUserByLogin(request.params.login);
}

export default async function (fastify: fastify.FastifyInstance, opts: Record<string, any>) {
	fastify.get('/', homeRoute)
	fastify.get('/users/:login', userRoute)
}
