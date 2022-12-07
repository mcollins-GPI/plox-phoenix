require('dotenv').config();
const fastify = require('fastify')({ logger: false });
const { Dropbox } = require('dropbox');
const dropbox = new Dropbox({
    clientId: process.env.client_id,
    clientSecret: process.env.client_secret,
    refreshToken: process.env.refresh_token,
});
const cachedInformation = {};

function getFolders(artist, album) {
    let fileList = [];
    let searchPath = `${artist ? `${album ? `/music/${artist}/${album}` : `/music/${artist}`}` : '/music'}`;

    function getMoreFolders(cursor) {
        return dropbox
            .filesListFolderContinue({ cursor: cursor })
            .then((response) => {
                console.log(response);
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

function getFileInfo(searchPath) {
    return dropbox
        .filesGetMetadata({ path: searchPath, include_media_info: true })
        .then((response) => {
            return response;
        })
        .catch((err) => {
            console.log(err);
        });
}

fastify.get('/', async (request, reply) => {
    reply.send('hello, world!');
});

fastify.get('/artist', async (request, reply) => {
    reply.send({ artist_list: cachedInformation.artist_list });
    // return getFolders()
    //     .then((response) => {
    //         reply.send({ artist_list: response });
    //     })
    //     .catch((error) => {
    //         reply.send({ error: error });
    //     });
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

fastify.get('/tracks', async (request, reply) => {
    return getFolders(request.headers.artist, request.headers.album, true)
        .then((response) => {
            reply.send({ track_list: response });
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
