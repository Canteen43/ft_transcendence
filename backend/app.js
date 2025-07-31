import dotenv from 'dotenv'
import Fastify from 'fastify'
import app from './fastify.js'

// Load .env
dotenv.config()

const fastify = Fastify({
  logger: { level: 'info' }
})

await fastify.register(app)

const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
