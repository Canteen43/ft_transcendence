import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope

export default fp(async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('someDecorator', function () {
    return 'hugs'
  })
})
