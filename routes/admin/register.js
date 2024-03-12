fastify.route({
    method: 'POST',
    url: '/register',
    schema: {
        body: {
            type: 'object',
            properties: {
                user: { type: 'string' },
                password: { type: 'string' },
            },
            required: ['user', 'password'],
        },
    },
    handler: (req, reply) => {
        req.log.info('Creating new user');
        fastify.level.authdb.put(req.body.user, req.body.password, onPut);

        function onPut(err) {
            if (err) return reply.send(err);
            fastify.jwt.sign(req.body, onToken);
        }

        function onToken(err, token) {
            if (err) return reply.send(err);
            req.log.info('User created');
            reply.send({ token });
        }
    },
});
