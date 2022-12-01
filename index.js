const fs = require('fs');

const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const { Readable } = require('stream');
const path = require('path');
require('dotenv').config();
const dropboxV2Api = require('dropbox-v2-api');
const open = require('open');

const dropbox = dropboxV2Api.authenticate({
    client_id: process.env.client_id,
    client_secret: process.env.client_secret,
    redirect_uri: 'http://localhost/plox-phoenix/data/oauth',
    token_access_type: 'offline',
    state: 'OPTIONAL_STATE_VALUE',
});
//generate and visit authorization sevice
open(dropbox.generateAuthUrl());

function getFolders(artist, album, metadata = false) {
    let fileList = [];
    let searchPath = `${artist ? `${album ? `/music/${artist}/${album}` : `/music/${artist}`}` : '/music'}`;

    return new Promise((resolve, reject) => {
        dropbox(
            {
                resource: 'files/list_folder',
                parameters: { path: searchPath, include_media_info: metadata },
            },
            (err, result, response) => {
                console.log(err, result, response);
                if (err) reject(err);
                if (result) {
                    if (result.entries) fileList = fileList.concat(result.entries);

                    //download completed
                    if (result.has_more) {
                        return getMoreFolders(result.cursor);
                    } else {
                        resolve(fileList);
                    }
                }
            }
        );

        function getMoreFolders(cursor) {
            dropbox(
                {
                    resource: 'files/list_folder/continue',
                    parameters: { cursor: cursor },
                },
                (err, result, response) => {
                    if (err) reject(err);
                    if (result) {
                        if (result.entries) fileList = fileList.concat(result.entries);

                        if (result.has_more) {
                            return getMoreFolders(result.cursor);
                        } else {
                            resolve(fileList);
                        }
                    }
                }
            );
        }
    });
}

function getFile(searchPath) {
    return dropbox(
        {
            resource: 'files/download',
            parameters: {
                path: searchPath,
            },
        },
        (err, result) => {
            //download completed
        }
    );
}

function getFileInfo(searchPath) {
    return new Promise((resolve, reject) => {
        dropbox(
            {
                resource: 'files/get_metadata',
                parameters: {
                    path: searchPath,
                    include_deleted: true,
                    include_has_explicit_shared_members: true,
                    include_media_info: false,
                },
            },
            (err, result) => {
                if (err) reject(err);
                resolve(result);
            }
        );
    });
}

fastify.get('/oauth', async function (request, reply) {
    var params = request.query;

    return new Promise((resolve) => {
        dropbox.getToken(params.code, function (err, response) {
            // console.log(err);
            // console.log("user's access_token: ", response.access_token);
            // console.log("user's refresh_token: ", response.refresh_token);
            // open('http://localhost/plox-phoenix/library')
            //call api
            // dropbox(
            //     {
            //         resource: 'users/get_current_account',
            //     },
            //     function (err, response) {
            //         console.log(err);
            //         resolve(response);
            //     }
            // );
            //or refresh token!
            // dropbox.refreshToken(response.refresh_token, (err, result) => {
            //     console.log(err);
            //     console.log(result);
            // });
        });
    });
});

fastify.get('/artist', async (request, reply) => {
    return getFolders()
        .then((response) => {
            return { artist_list: response };
        })
        .catch((error) => {
            return { error: error };
        });
});

fastify.get('/album', async (request, reply) => {
    console.log(request.headers.artist);
    return getFolders(request.headers.artist)
        .then((response) => {
            return { album_list: response };
        })
        .catch((error) => {
            return { error: error };
        });
});

fastify.get('/tracks', async (request, reply) => {
    return getFolders(request.headers.artist, request.headers.album, true)
        .then((response) => {
            return { track_list: response };
        })
        .catch((error) => {
            return { error: error };
        });
});

fastify.get('/track', (request, reply) => {
    reply.type('application/octet-stream');
    reply.send(getFile(request.headers.path));
});

fastify.get('/track-info', async (request, reply) => {
    getFileInfo(request.headers.path)
        .then((fileInfo) => {
            reply.header('Content-Type', 'application/json; charset=utf-8');
            reply.send(fileInfo);
        })
        .catch((error) => {
            reply.send(error);
        });
});

// // LAUNCH SERVER
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
