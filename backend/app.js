import dotenv from 'dotenv'
import Fastify from 'fastify'
import fastifyApp from './fastify.js'

// Load .env
dotenv.config()

const fastify = Fastify({
	logger: { level: 'info' }
})

await fastify.register(fastifyApp)

async function start() {
	try {
		await fastify.listen({
			port: process.env.PORT,
			host: '0.0.0.0'
		})
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

start()
