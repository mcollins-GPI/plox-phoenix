// route schema
const schema = {
    description: 'This route returns a cached list of all artists in main directory specified by the user.',
    tags: ['meta'],
    params: {},
    querystring: {},
};

// create route
module.exports = function (fastify, opts, next) {
    fastify.route({
        method: 'GET',
        url: '/artist',
        schema: schema,
        preHandler: fastify.auth([fastify.verifyToken]),
        handler: function (request, reply) {
            reply.send({ artist_list: cachedInformation.artist_list });
        },
    });
    next();
};

module.exports.autoPrefix = '/meta';
