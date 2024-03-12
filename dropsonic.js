require('dotenv').config();
const fastify = require('fastify')({ logger: false });
fastify.register(require('@fastify/jwt'), { secret: 'superbbq' });
fastify.register(require('@fastify/leveldb'), { name: 'authdb' });
fastify.register(require('@fastify/auth'));
// fastify.register(require('@fastify/cors'));
// fastify.register(require('@fastify/autoload'), {
//     dir: path.join(__dirname, 'routes'),
// });
fastify.after(() => {
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

    fastify.route({
        method: 'GET',
        url: '/auth',
        preHandler: fastify.auth([fastify.verifyJWTandLevelDB]),
        handler: (req, reply) => {
            req.log.info('Auth route');
            reply.send({ hello: 'world' });
        },
    });

    fastify.route({
        method: 'POST',
        url: '/auth-multiple',
        preHandler: fastify.auth([
            // Only one of these has to pass
            fastify.verifyJWTandLevelDB,
            fastify.verifyUserAndPassword,
        ]),
        handler: (req, reply) => {
            fastify.level.authdb.get(req.body.user, req.body.password, onGet);
            function onGet(err) {
                if (err) return reply.send(err);
                fastify.jwt.sign(req.body, onToken);
            }
            function onToken(err, token) {
                if (err) return reply.send(err);
                req.log.info('User created');
                reply.send({ token });
            }

            // req.log.info('Auth route');
            // reply.send({ hello: 'world' });
        },
    });

    fastify.get('/artist', async (request, reply) => {
        reply.send({ artist_list: cachedInformation.artist_list });
    });

    fastify.get('/refresh-artist', async (request, reply) => {
        return getFolders()
            .then((response) => {
                cachedInformation.artist_list = response;

                reply.send({ artist_list: response });
            })
            .catch((error) => {
                reply.send({ error: error });
            });
    });

    fastify.get('/album', async (request, reply) => {
        return getFolders(request.headers.artist)
            .then((response) => {
                reply.send({ album_list: response });
            })
            .catch((error) => {
                reply.send({ error: error });
            });
    });

    fastify.get('/tracklist', async (request, reply) => {
        return getFolders(request.headers.artist, request.headers.album, true)
            .then((response) => {
                reply.send({ tracklist: response });
            })
            .catch((error) => {
                reply.send({ error: error });
            });
    });

    fastify.get('/track', async (request, reply) => {
        return getFile(request.headers.path)
            .then((response) => {
                reply.type('application/octet-stream');
                reply.send(response);
            })
            .catch((error) => {
                reply.send({ error: error });
            });
    });

    fastify.get('/track-info', async (request, reply) => {
        getFileInfo(request.headers.path)
            .then((fileInfo) => {
                reply.header('Content-Type', 'application/json; charset=utf-8');
                reply.send({ file_info: fileInfo });
            })
            .catch((error) => {
                reply.send({ error: error });
            });
    });
});

const { Dropbox } = require('dropbox');
const dropbox = new Dropbox({
    clientId: process.env.client_id,
    clientSecret: process.env.client_secret,
    refreshToken: process.env.refresh_token,
});

const cachedInformation = {};

fastify.decorate('verifyJWTandLevelDB', verifyJWTandLevelDB);
fastify.decorate('verifyUserAndPassword', verifyUserAndPassword);

function verifyJWTandLevelDB(request, reply, done) {
    const jwt = this.jwt;
    const level = this.level.authdb;

    if (request.body && request.body.failureWithReply) {
        reply.code(401).send({ error: 'Unauthorized' });
        return done(new Error());
    }

    if (!request.raw.headers.auth) {
        return done(new Error('Missing token header'));
    }

    jwt.verify(request.raw.headers.auth, onVerify);

    function onVerify(err, decoded) {
        if (err || !decoded.user || !decoded.password) {
            return done(new Error('Token not valid'));
        }

        level.get(decoded.user, onUser);

        function onUser(err, password) {
            if (err) {
                if (err.notFound) {
                    return done(new Error('Token not valid'));
                }
                return done(err);
            }

            if (!password || password !== decoded.password) {
                return done(new Error('Token not valid'));
            }

            done();
        }
    }
}

function verifyUserAndPassword(request, reply, done) {
    const level = this.level.authdb;

    if (!request.body || !request.body.user) {
        return done(new Error('Missing user in request body'));
    }

    level.get(request.body.user, onUser);

    function onUser(err, password) {
        if (err) {
            if (err.notFound) {
                return done(new Error('Password not valid'));
            }
            return done(err);
        }

        if (!password || password !== request.body.password) {
            return done(new Error('Password not valid'));
        }

        done();
    }
}

function getFolders(artist, album) {
    let fileList = [];
    let searchPath = `${artist ? `${album ? `/music/${artist}/${album}` : `/music/${artist}`}` : '/music'}`;

    function getMoreFolders(cursor) {
        return dropbox
            .filesListFolderContinue({ cursor: cursor })
            .then((response) => {
                if (response.result.entries) fileList = fileList.concat(response.result.entries);
                if (response.result.has_more) {
                    return getMoreFolders(response.result.cursor);
                } else {
                    return fileList;
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    return dropbox
        .filesListFolder({ path: searchPath })
        .then((response) => {
            if (response.result.entries) fileList = fileList.concat(response.result.entries);
            if (response.result.has_more) {
                return getMoreFolders(response.result.cursor);
            } else {
                return fileList;
            }
        })
        .catch((err) => {
            console.log(err);
        });
}

function getFile(searchPath) {
    return dropbox
        .filesDownload({ path: searchPath })
        .then((response) => {
            return response.result.fileBinary;
        })
        .catch((err) => {
            console.log(err);
        });
}

function getFileHeader(searchPath) {
    return dropbox
        .filesDownload({ path: searchPath })
        .then((response) => {
            return response;
        })
        .catch((err) => {
            console.log(err);
        });
}

getFolders()
    .then((response) => {
        cachedInformation.artist_list = response;
        console.log('artists loaded!');

        fastify.listen(
            { port: process.env.SERVER_PORT || 3000, host: process.env.SERVER_HOST || '0.0.0.0' },
            (err, address) => {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }

                console.info(`Server listening on ${address}`);
            }
        );
    })
    .catch((error) => {
        reply.send({ error: error });
    });
