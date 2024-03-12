fastify.route({
    method: 'GET',
    url: '/auth',
    preHandler: fastify.auth([fastify.verifyJWTandLevelDB]),
    handler: (req, reply) => {
      req.log.info('Auth route')
      reply.send({ hello: 'world' })
    }
  })