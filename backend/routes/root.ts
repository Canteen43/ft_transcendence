import UserRepository from '../repositories/user_repository.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const homeRoute = async function (
	request: FastifyRequest
) {
	return { msg: "Hello World" }
}

const userRoute = async function (
	request: FastifyRequest<{ Params: { login: string } }>,
) {
	return UserRepository.getUserByLogin(request.params.login);
}

export default async function (fastify: FastifyInstance, opts: Record<string, any>) {
	fastify.get('/', homeRoute)
	fastify.get('/users/:login', userRoute)
}
