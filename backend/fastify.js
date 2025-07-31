'use strict'

import path from 'node:path'
import AutoLoad from '@fastify/autoload'
import url from 'node:url'

// Pass --options via CLI arguments in command to enable these options.
const options = {}

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async function (fastify, opts) {
  // Do not touch the following lines
  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}

const _options = options
export { _options as options }
