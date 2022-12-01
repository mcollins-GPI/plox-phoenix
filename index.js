const fs = require('fs');

const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const { Readable } = require('stream');
const path = require('path');
require('dotenv').config();
const dropboxV2Api = require('dropbox-v2-api');

const dropbox = dropboxV2Api.authenticate({
    token: 'sl.BUHeXFmnGY-3eo4FwM4G6OlIY9A_OuIOuLD1B2iIgqWonenNZvwdILqfee3rpjsGl5Qd9P1oZoUKxi_BO8bzXcoHB8dK9mUAhf0dPqc2P0DYGMSM-0hgO9cOnDCJmY_ySaoAxffb',
    client_id: 'chd4jap4680m01b',
    client_secret: 'tcdwbbyvhe182ed',
});

function getFolders(artist, album) {
    let fileList = [];
    let searchPath = `${artist ? `${album ? `/music/${artist}/${album}` : `/music/${artist}`}` : '/music'}`;

    return new Promise((resolve, reject) => {
        dropbox(
            {
                resource: 'files/list_folder',
                parameters: { path: searchPath },
            },
            (err, result, response) => {
                console.log(err, result, response);
                fileList = fileList.concat(result.entries);

                //download completed
                if (result.has_more) {
                    return getMoreFolders(result.cursor);
                } else {
                    resolve(fileList);
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
                    console.log(err, result, response);
                    fileList = fileList.concat(result.entries);

                    if (result.has_more) {
                        return getMoreFolders(result.cursor);
                    } else {
                        resolve(fileList);
                    }
                }
            );
        }
    });
}

async function getFile(searchPath) {
    // try {
    //     const downloadStream = dropbox({
    //         resource: 'files/download',
    //         parameters: { path: searchPath },
    //     });

    //     return downloadStream;
    // } catch (error) {
    //     console.error(error);
    // }
    // return dropbox(
    //     {
    //         resource: 'files/download',
    //         parameters: {
    //             path: searchPath,
    //         },
    //     },
    //     (err, result, response) => {
    //         //download completed
    //     }
    // ).pipe(fs.createReadStream('./04 the sign.mp3'));

    var readStream = fs.createReadStream(path.join(__dirname, '/audio/believe.mp3'));

    // This will wait until we know the readable stream is actually valid before piping
    readStream.on('open', function () {
        // This just pipes the read stream to the response object (which goes to the client)
        readStream.pipe(res);
    });
}

fastify.get('/artist', async (request, reply) => {
    return getFolders().then((response) => {
        console.log(response);
        return { artist_list: response };
    });
});

fastify.get('/album/:artist', async (request, reply) => {
    return getFolders(request.params.artist).then((response) => {
        console.log(response);
        return { album_list: response };
    });
});

fastify.get('/tracks/:artist/:album', async (request, reply) => {
    return getFolders(request.params.artist, request.params.album).then((response) => {
        console.log(response);
        return { track_list: response };
    });
});

// fastify.post(
//     '/track',
//     {
//         schema: {
//             body: {
//                 type: 'object',
//                 properties: {
//                     path: { type: 'string' },
//                 },
//             },
//         },
//     },
//     (request, reply) => {
//         let searchPath = '/music/alkaline trio/crimson [2005]/04 mercy me.mp3';
//         reply.type('audio/mp3');
//         reply.send(
//             dropbox(
//                 {
//                     resource: 'files/download',
//                     parameters: {
//                         path: searchPath,
//                     },
//                 },
//                 (err, result) => {
//                     //download completed
//                 }
//             )
//         );
//     }
// );

fastify.get('/track', (request, reply) => {
    let searchPath = '/music/alkaline trio/crimson [2005]/04 mercy me.mp3';

    console.log(request.headers.path === searchPath);
    reply.type('application/octet-stream');
    reply.send(
        dropbox(
            {
                resource: 'files/download',
                parameters: {
                    path: request.headers.path,
                },
            },
            (err, result) => {
                //download completed
            }
        )
    );
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
