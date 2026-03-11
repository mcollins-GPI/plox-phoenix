require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const fastify = require('fastify')({ logger: false });
const { Dropbox } = require('dropbox');

const USER_PREFIX = 'user!';
const PASSWORD_MIN_LENGTH = 8;
const TOKEN_TTL = '12h';
const isProduction = process.env.NODE_ENV === 'production';
const envAuthSecret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;

if (!envAuthSecret && isProduction) {
    throw new Error('AUTH_JWT_SECRET (or JWT_SECRET) must be set in production to ensure stable JWT tokens.');
}

const authSecret = envAuthSecret || crypto.randomBytes(32).toString('hex');
const cachedInformation = { artist_list: [] };

fastify.register(require('@fastify/cors'));
fastify.register(require('@fastify/jwt'), { secret: authSecret });
fastify.register(require('@fastify/leveldb'), { name: 'authdb' });
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/',
});

const dropbox = new Dropbox({
    clientId: process.env.client_id,
    clientSecret: process.env.client_secret,
    refreshToken: process.env.refresh_token,
});

let cachedNodeFetch = null;

async function httpFetch(...args) {
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch(...args);
    }

    if (!cachedNodeFetch) {
        const { default: nodeFetch } = await import('node-fetch');
        cachedNodeFetch = nodeFetch;
    }

    return cachedNodeFetch(...args);
}

function normalizeUsername(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
        throw new Error('Usernames must be 3-32 characters and use only letters, numbers, dot, dash, or underscore.');
    }

    return normalized;
}

function validatePassword(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`Passwords must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
    }

    if (password.length > 128) {
        throw new Error('Passwords must be 128 characters or fewer.');
    }
}

function userKey(username) {
    return `${USER_PREFIX}${username}`;
}

function decodeValue(value) {
    const text = Buffer.isBuffer(value) ? value.toString('utf8') : value;

    if (typeof text !== 'string') {
        return text;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const digest = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${digest}`;
}

function verifyPassword(password, passwordHash) {
    if (typeof passwordHash !== 'string' || !passwordHash) {
        return false;
    }

    if (!passwordHash.startsWith('scrypt:')) {
        return passwordHash === password;
    }

    const [, salt, digest] = passwordHash.split(':');
    const candidate = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(digest, 'hex');

    return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function toStoredUserRecord(username, value) {
    const decoded = decodeValue(value);

    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
        return {
            user: normalizeUsername(decoded.user || username),
            enabled: decoded.enabled !== false,
            isAdmin: decoded.isAdmin === true,
            mustChangePassword: decoded.mustChangePassword === true,
            passwordHash: decoded.passwordHash || '',
            createdAt: decoded.createdAt || null,
            updatedAt: decoded.updatedAt || decoded.createdAt || null,
            createdBy: decoded.createdBy || null,
            updatedBy: decoded.updatedBy || null,
            lastLoginAt: decoded.lastLoginAt || null,
        };
    }

    return {
        user: username,
        enabled: true,
        isAdmin: false,
        mustChangePassword: false,
        passwordHash: typeof decoded === 'string' ? decoded : '',
        createdAt: null,
        updatedAt: null,
        createdBy: null,
        updatedBy: null,
        lastLoginAt: null,
    };
}

function sanitizeUser(user) {
    return {
        user: user.user,
        enabled: user.enabled,
        isAdmin: user.isAdmin,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
        lastLoginAt: user.lastLoginAt,
    };
}

function issueToken(user) {
    return fastify.jwt.sign(
        {
            user: user.user,
            isAdmin: user.isAdmin,
        },
        { expiresIn: TOKEN_TTL },
    );
}

function putDb(key, value) {
    return new Promise((resolve, reject) => {
        fastify.level.authdb.put(key, value, (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

function deleteDb(key) {
    return new Promise((resolve, reject) => {
        fastify.level.authdb.del(key, (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

function getDb(key) {
    return new Promise((resolve, reject) => {
        fastify.level.authdb.get(key, (err, value) => {
            if (err) {
                if (err.notFound) {
                    resolve(null);
                    return;
                }

                reject(err);
                return;
            }

            resolve(value);
        });
    });
}

async function getUser(username) {
    const normalized = normalizeUsername(username);
    const record = await getDb(userKey(normalized));

    if (record == null) {
        return null;
    }

    return toStoredUserRecord(normalized, record);
}

async function saveUser(user) {
    const stored = {
        user: normalizeUsername(user.user),
        enabled: user.enabled !== false,
        isAdmin: user.isAdmin === true,
        mustChangePassword: user.mustChangePassword === true,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || new Date().toISOString(),
        createdBy: user.createdBy || null,
        updatedBy: user.updatedBy || null,
        lastLoginAt: user.lastLoginAt || null,
    };

    await putDb(userKey(stored.user), JSON.stringify(stored));
    return stored;
}

function listUsers() {
    return new Promise((resolve, reject) => {
        const users = [];
        const stream = fastify.level.authdb.createReadStream({
            gte: USER_PREFIX,
            lt: `${USER_PREFIX}~`,
        });

        stream.on('data', ({ key, value }) => {
            const username = String(key).slice(USER_PREFIX.length);
            users.push(toStoredUserRecord(username, value));
        });
        stream.on('error', reject);
        stream.on('end', () => {
            resolve(
                users.sort((left, right) => {
                    return left.user.localeCompare(right.user);
                }),
            );
        });
    });
}

async function ensureAdminFloor(targetUserName, nextState = {}, deleted = false) {
    const users = await listUsers();
    const effectiveUsers = users.flatMap((user) => {
        if (user.user !== targetUserName) {
            return [user];
        }

        if (deleted) {
            return [];
        }

        return [{ ...user, ...nextState }];
    });

    if (!effectiveUsers.some((user) => user.enabled && user.isAdmin)) {
        throw new Error('At least one enabled admin account is required.');
    }
}

async function requireAuth(request, reply) {
    const authorization = request.headers.authorization;

    if (!authorization) {
        reply.code(401).send({ error: 'Authentication required.' });
        return;
    }

    try {
        const decoded = await request.jwtVerify();
        const user = await getUser(decoded.user);

        if (!user || !user.enabled) {
            reply.code(401).send({ error: 'Authentication required.' });
            return;
        }

        request.userRecord = user;
    } catch (error) {
        reply.code(401).send({ error: 'Authentication required.' });
    }
}

async function requireAdmin(request, reply) {
    await requireAuth(request, reply);

    if (!request.userRecord) {
        return;
    }

    if (!request.userRecord.isAdmin) {
        reply.code(403).send({ error: 'Administrator access is required.' });
    }
}

async function getFile(searchPath, rangeHeader) {
    const token = await dropbox.auth.getAccessToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: searchPath }),
    };

    if (rangeHeader) {
        headers.Range = rangeHeader;
    }

    const response = await httpFetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers,
    });

    if (!response.ok && response.status !== 206) {
        throw new Error(`Dropbox download failed: ${response.status}`);
    }

    return {
        status: response.status,
        headers: response.headers,
        buffer: Buffer.from(await response.arrayBuffer()),
    };
}

async function getFileInfo(searchPath) {
    const response = await dropbox.filesGetMetadata({ path: searchPath });
    return response.result;
}

function getFolders(artist, album) {
    let fileList = [];
    const searchPath = `${artist ? `${album ? `/music/${artist}/${album}` : `/music/${artist}`}` : '/music'}`;

    function getMoreFolders(cursor) {
        return dropbox.filesListFolderContinue({ cursor }).then((response) => {
            if (response.result.entries) {
                fileList = fileList.concat(response.result.entries);
            }

            if (response.result.has_more) {
                return getMoreFolders(response.result.cursor);
            }

            return fileList;
        });
    }

    return dropbox.filesListFolder({ path: searchPath }).then((response) => {
        if (response.result.entries) {
            fileList = fileList.concat(response.result.entries);
        }

        if (response.result.has_more) {
            return getMoreFolders(response.result.cursor);
        }

        return fileList;
    });
}

async function ensureArtistCache(forceRefresh = false) {
    if (!forceRefresh && cachedInformation.artist_list.length > 0) {
        return cachedInformation.artist_list;
    }

    cachedInformation.artist_list = await getFolders();
    return cachedInformation.artist_list;
}

fastify.get('/', async (request, reply) => {
    reply.redirect('/login/');
});

fastify.get('/login', async (request, reply) => {
    reply.redirect('/login/');
});

fastify.get('/library', async (request, reply) => {
    reply.redirect('/library/');
});

fastify.get('/admin', async (request, reply) => {
    reply.redirect('/admin/');
});

fastify.get('/account', async (request, reply) => {
    reply.redirect('/account/');
});

fastify.get('/api/auth/status', async () => {
    const users = await listUsers();

    return {
        hasUsers: users.length > 0,
        bootstrapRequired: users.length === 0,
    };
});

fastify.post('/api/auth/bootstrap', async (request, reply) => {
    const users = await listUsers();

    if (users.length > 0) {
        reply.code(409).send({ error: 'Authentication has already been initialized.' });
        return;
    }

    try {
        const user = normalizeUsername(request.body?.user);
        const password = request.body?.password;

        validatePassword(password);

        const timestamp = new Date().toISOString();
        const createdUser = await saveUser({
            user,
            enabled: true,
            isAdmin: true,
            mustChangePassword: false,
            passwordHash: hashPassword(password),
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: 'bootstrap',
            updatedBy: 'bootstrap',
            lastLoginAt: timestamp,
        });

        reply.code(201).send({
            token: issueToken(createdUser),
            user: sanitizeUser(createdUser),
        });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.post('/api/auth/login', async (request, reply) => {
    try {
        const username = normalizeUsername(request.body?.user);
        const password = String(request.body?.password || '');
        const user = await getUser(username);

        if (!user || !verifyPassword(password, user.passwordHash)) {
            reply.code(401).send({ error: 'Invalid username or password.' });
            return;
        }

        if (!user.enabled) {
            reply.code(403).send({ error: 'This account is disabled.' });
            return;
        }

        const timestamp = new Date().toISOString();
        const updatedUser = await saveUser({
            ...user,
            passwordHash: user.passwordHash.startsWith('scrypt:') ? user.passwordHash : hashPassword(password),
            lastLoginAt: timestamp,
            updatedAt: timestamp,
            updatedBy: user.user,
        });

        reply.send({
            token: issueToken(updatedUser),
            user: sanitizeUser(updatedUser),
        });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    return { user: sanitizeUser(request.userRecord) };
});

fastify.post('/api/auth/password', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const currentPassword = String(request.body?.currentPassword || '');
        const newPassword = String(request.body?.newPassword || '');

        if (!verifyPassword(currentPassword, request.userRecord.passwordHash)) {
            reply.code(400).send({ error: 'Current password is not correct.' });
            return;
        }

        validatePassword(newPassword);

        const updatedUser = await saveUser({
            ...request.userRecord,
            passwordHash: hashPassword(newPassword),
            mustChangePassword: false,
            updatedAt: new Date().toISOString(),
            updatedBy: request.userRecord.user,
        });

        reply.send({ user: sanitizeUser(updatedUser) });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.get('/api/admin/users', { preHandler: requireAdmin }, async () => {
    const users = await listUsers();
    return { users: users.map(sanitizeUser) };
});

fastify.post('/api/admin/users', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const user = normalizeUsername(request.body?.user);
        const password = request.body?.password;

        validatePassword(password);

        if (await getUser(user)) {
            reply.code(409).send({ error: 'That user already exists.' });
            return;
        }

        const timestamp = new Date().toISOString();
        const createdUser = await saveUser({
            user,
            enabled: request.body?.enabled !== false,
            isAdmin: request.body?.isAdmin === true,
            mustChangePassword: request.body?.mustChangePassword !== false,
            passwordHash: hashPassword(password),
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: request.userRecord.user,
            updatedBy: request.userRecord.user,
            lastLoginAt: null,
        });

        reply.code(201).send({ user: sanitizeUser(createdUser) });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.patch('/api/admin/users/:user', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const targetUserName = normalizeUsername(request.params.user);
        const targetUser = await getUser(targetUserName);

        if (!targetUser) {
            reply.code(404).send({ error: 'User not found.' });
            return;
        }

        const nextState = {
            isAdmin: request.body?.isAdmin === true,
            enabled: request.body?.enabled !== false,
        };

        await ensureAdminFloor(targetUser.user, nextState);

        const updatedUser = await saveUser({
            ...targetUser,
            ...nextState,
            updatedAt: new Date().toISOString(),
            updatedBy: request.userRecord.user,
        });

        reply.send({ user: sanitizeUser(updatedUser) });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.post('/api/admin/users/:user/reset', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const targetUserName = normalizeUsername(request.params.user);
        const targetUser = await getUser(targetUserName);

        if (!targetUser) {
            reply.code(404).send({ error: 'User not found.' });
            return;
        }

        const password = String(request.body?.password || '');
        validatePassword(password);

        const updatedUser = await saveUser({
            ...targetUser,
            passwordHash: hashPassword(password),
            mustChangePassword: true,
            updatedAt: new Date().toISOString(),
            updatedBy: request.userRecord.user,
        });

        reply.send({ user: sanitizeUser(updatedUser) });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.delete('/api/admin/users/:user', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const targetUserName = normalizeUsername(request.params.user);
        const targetUser = await getUser(targetUserName);

        if (!targetUser) {
            reply.code(404).send({ error: 'User not found.' });
            return;
        }

        if (targetUser.user === request.userRecord.user) {
            reply.code(400).send({ error: 'You cannot delete your own account.' });
            return;
        }

        await ensureAdminFloor(targetUser.user, {}, true);
        await deleteDb(userKey(targetUser.user));
        reply.code(204).send();
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

fastify.get('/artist', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const artistList = await ensureArtistCache();
        reply.send({ artist_list: artistList });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load artists.' });
    }
});

fastify.get('/refresh-artist', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const artistList = await ensureArtistCache(true);
        reply.send({ artist_list: artistList });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to refresh artists.' });
    }
});

fastify.get('/album', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const artist = request.headers.artist;
        const albums = await getFolders(artist);
        reply.send({ album_list: albums });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load albums.' });
    }
});

fastify.get('/tracks', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const tracks = await getFolders(request.headers.artist, request.headers.album, true);
        reply.send({ track_list: tracks });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load tracks.' });
    }
});

fastify.get('/track', { preHandler: requireAuth }, async (request, reply) => {
    const trackPath = request.headers.path;
    const range = request.headers.range;

    if (!trackPath) {
        reply.code(400).send({ error: 'Missing path header.' });
        return;
    }

    try {
        const result = await getFile(trackPath, range);

        if (result.status === 206) {
            reply.code(206).header('Accept-Ranges', 'bytes').header('Content-Range', result.headers.get('content-range'));
        }

        reply.header('Content-Type', 'audio/mpeg').send(result.buffer);
    } catch (error) {
        reply.code(500).send({ error: 'Failed to retrieve track.' });
    }
});

fastify.get('/track-info', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.headers.path) {
        reply.code(400).send({ error: 'Missing path header.' });
        return;
    }

    try {
        const fileInfo = await getFileInfo(request.headers.path);
        reply.header('Content-Type', 'application/json; charset=utf-8').send({ file_info: fileInfo });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load track information.' });
    }
});

async function start() {
    await fastify.listen({
        port: process.env.SERVER_PORT || 3000,
        host: process.env.SERVER_HOST || '0.0.0.0',
    });

    try {
        await ensureArtistCache();
        console.info('artists loaded!');
    } catch (error) {
        console.warn('Artist cache warmup failed.', error.message);
    }
}

start().catch((error) => {
    console.error(error);
    process.exit(1);
});
