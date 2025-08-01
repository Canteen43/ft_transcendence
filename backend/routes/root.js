import UserRepository from '../repositories/user_repository.js'

const homeRoute = async function (request, reply) {
	return { msg: "Hello World" }
}

const userRoute = async (request, reply) => {
	return UserRepository.getUserByLogin(request.params.login);
}

export default async function (fastify, opts) {
	fastify.get('/', homeRoute)
	fastify.get('/users/:login', userRoute)
}
