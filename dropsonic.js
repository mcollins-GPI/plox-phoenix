require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const fastify = require('fastify')({ logger: false });
const { Dropbox } = require('dropbox');

const AUDIO_MIME_TYPES = {
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/opus',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    aiff: 'audio/aiff',
    aif: 'audio/aiff',
    wma: 'audio/x-ms-wma',
    webm: 'audio/webm',
};

const BUFFERED_EXTENSIONS = new Set(['m4a', 'aac', 'mp4', 'webm']);

function needsBuffering(filePath) {
    const ext = String(filePath || '')
        .split('.')
        .pop()
        .toLowerCase();
    return BUFFERED_EXTENSIONS.has(ext);
}

function getMimeType(filePath) {
    const ext = String(filePath || '')
        .split('.')
        .pop()
        .toLowerCase();
    return AUDIO_MIME_TYPES[ext] || 'application/octet-stream';
}

const USER_PREFIX = 'user!';
const PASSWORD_MIN_LENGTH = 8;
const TOKEN_TTL = '12h';
const isProduction = process.env.NODE_ENV === 'production';
const envAuthSecret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
const clientApiBasePath = normalizeBasePath(process.env.CLIENT_API_BASE_PATH || '/dropsonic/data');
const fallbackDataBasePath = '/data';

if (!envAuthSecret && isProduction) {
    throw new Error('AUTH_JWT_SECRET (or JWT_SECRET) must be set in production to ensure stable JWT tokens.');
}

const authSecret = envAuthSecret || crypto.randomBytes(32).toString('hex');
const cachedInformation = { artist_list: [] };

// Check if ffmpeg is present on the system (non-fatal — transcoding is
// disabled gracefully when ffmpeg is missing).
let ffmpegAvailable = false;
try {
    require('child_process').execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    ffmpegAvailable = true;
} catch {
    console.warn('ffmpeg not found — transcoding endpoint will be disabled.');
}

// Disk cache for transcoded fMP4 files — avoids re-transcoding the same track.
const TRANSCODE_CACHE_DIR = path.join(__dirname, '.transcode-cache');
try {
    fs.mkdirSync(TRANSCODE_CACHE_DIR, { recursive: true });
} catch {
    console.warn('Could not create transcode cache directory.');
}

function transcodeCacheKey(trackPath) {
    return crypto.createHash('sha256').update(trackPath.toLowerCase()).digest('hex') + '.mp4';
}

function getCachedTranscode(trackPath) {
    const file = path.join(TRANSCODE_CACHE_DIR, transcodeCacheKey(trackPath));
    try {
        return fs.readFileSync(file);
    } catch {
        return null;
    }
}

function setCachedTranscode(trackPath, buffer) {
    const file = path.join(TRANSCODE_CACHE_DIR, transcodeCacheKey(trackPath));
    try {
        fs.writeFileSync(file, buffer);
    } catch (err) {
        console.warn('Cache write failed:', err?.message ?? err);
    }
}

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

function normalizeBasePath(value) {
    const raw = String(value || '').trim();

    if (!raw || raw === '/') {
        return '/';
    }

    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/u, '');
}

function prefixedUrl(url) {
    if (clientApiBasePath === '/') {
        return url;
    }

    return `${clientApiBasePath}${url}`.replace(/\/+/gu, '/');
}

function buildRouteAliases(url) {
    const aliases = new Set([url]);

    if (clientApiBasePath !== '/') {
        aliases.add(prefixedUrl(url));
    }

    if (fallbackDataBasePath !== '/' && fallbackDataBasePath !== clientApiBasePath) {
        aliases.add(`${fallbackDataBasePath}${url}`.replace(/\/+/gu, '/'));
    }

    return Array.from(aliases);
}

function registerAliasedRoute(method, url, optionsOrHandler, maybeHandler) {
    const hasOptions = typeof optionsOrHandler !== 'function';
    const options = hasOptions ? { ...optionsOrHandler } : {};
    const handler = hasOptions ? maybeHandler : optionsOrHandler;

    buildRouteAliases(url).forEach((routeUrl) => {
        fastify.route({
            method,
            url: routeUrl,
            ...options,
            handler,
        });
    });
}

function sendRuntimeConfig(reply) {
    const payload = `window.DropsonicRuntime = Object.assign({}, window.DropsonicRuntime, { apiBasePath: ${JSON.stringify(clientApiBasePath)} });`;
    reply.type('application/javascript; charset=utf-8').header('Cache-Control', 'no-store').send(payload);
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
            sharePresence: decoded.sharePresence !== false,
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
        sharePresence: true,
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
        sharePresence: user.sharePresence !== false,
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
        sharePresence: user.sharePresence !== false,
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

function escapeNonAscii(str) {
    return str.replace(/[^\x20-\x7E]/gu, (ch) => {
        const code = ch.codePointAt(0);
        if (code <= 0xffff) {
            return `\\u${code.toString(16).padStart(4, '0')}`;
        }
        // Surrogate pair for characters above BMP
        const hi = Math.floor((code - 0x10000) / 0x400) + 0xd800;
        const lo = ((code - 0x10000) % 0x400) + 0xdc00;
        return `\\u${hi.toString(16)}\\u${lo.toString(16)}`;
    });
}

function buildDropboxApiArg(obj) {
    return escapeNonAscii(JSON.stringify(obj));
}

async function getFile(searchPath, rangeHeader) {
    const token = await dropbox.auth.getAccessToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': buildDropboxApiArg({ path: searchPath }),
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

async function getFileStream(searchPath, rangeHeader) {
    const token = await dropbox.auth.getAccessToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': buildDropboxApiArg({ path: searchPath }),
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
        body: response.body,
    };
}

async function getFileInfo(searchPath) {
    const response = await dropbox.filesGetMetadata({ path: searchPath });
    return response.result;
}

function normalizeEntryNames(entries) {
    return entries.map((entry) => ({
        ...entry,
        name: entry.name ? entry.name.normalize('NFC') : entry.name,
        path_display: entry.path_display ? entry.path_display.normalize('NFC') : entry.path_display,
    }));
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

            return normalizeEntryNames(fileList);
        });
    }

    return dropbox.filesListFolder({ path: searchPath }).then((response) => {
        if (response.result.entries) {
            fileList = fileList.concat(response.result.entries);
        }

        if (response.result.has_more) {
            return getMoreFolders(response.result.cursor);
        }

        return normalizeEntryNames(fileList);
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

registerAliasedRoute('GET', '/runtime-config.js', async (request, reply) => {
    sendRuntimeConfig(reply);
});

fastify.get('/data/runtime-config.is', async (request, reply) => {
    sendRuntimeConfig(reply);
});

registerAliasedRoute('GET', '/api/auth/status', async () => {
    const users = await listUsers();

    return {
        hasUsers: users.length > 0,
        bootstrapRequired: users.length === 0,
    };
});

registerAliasedRoute('POST', '/api/auth/bootstrap', async (request, reply) => {
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

registerAliasedRoute('POST', '/api/auth/login', async (request, reply) => {
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

registerAliasedRoute('GET', '/api/auth/me', { preHandler: requireAuth }, async (request) => {
    return { user: sanitizeUser(request.userRecord) };
});

registerAliasedRoute('POST', '/api/auth/password', { preHandler: requireAuth }, async (request, reply) => {
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

registerAliasedRoute('POST', '/api/auth/preferences', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const updates = {};
        if (typeof request.body?.sharePresence === 'boolean') {
            updates.sharePresence = request.body.sharePresence;
        }

        if (Object.keys(updates).length === 0) {
            reply.code(400).send({ error: 'No supported preference fields were provided.' });
            return;
        }

        const updatedUser = await saveUser({
            ...request.userRecord,
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: request.userRecord.user,
        });

        // If the user just turned off presence sharing, drop their entry from
        // the live map so other clients stop seeing them on the next poll.
        if (updates.sharePresence === false) {
            clearPresence(updatedUser.user);
        }

        reply.send({ user: sanitizeUser(updatedUser) });
    } catch (error) {
        reply.code(400).send({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Now-playing presence — clients POST what they are listening to and poll
// the GET endpoint to render the "friends listening" widget. State lives in
// memory only (presence is transient; restarts clear it).
// ---------------------------------------------------------------------------
const PRESENCE_STALE_MS = 90 * 1000;
const presence = new Map();

function clearPresence(username) {
    if (typeof username === 'string') {
        presence.delete(username);
    }
}

function pruneStalePresence(now = Date.now()) {
    for (const [username, info] of presence) {
        if (now - info.updatedAt > PRESENCE_STALE_MS) {
            presence.delete(username);
        }
    }
}

setInterval(() => pruneStalePresence(), 30 * 1000).unref();

function sanitizePresenceField(value, maxLength = 200) {
    if (value == null) {
        return '';
    }
    return String(value).slice(0, maxLength).trim();
}

registerAliasedRoute('POST', '/api/nowplaying', { preHandler: requireAuth }, async (request, reply) => {
    const username = request.userRecord.user;

    // If this user has opted out, silently no-op so clients don't need to
    // know about the preference state to function.
    if (request.userRecord.sharePresence === false) {
        clearPresence(username);
        reply.code(204).send();
        return;
    }

    const body = request.body;
    if (body == null || body === false) {
        clearPresence(username);
        reply.code(204).send();
        return;
    }

    const track = sanitizePresenceField(body.track);
    if (!track) {
        clearPresence(username);
        reply.code(204).send();
        return;
    }

    presence.set(username, {
        user: username,
        track,
        artist: sanitizePresenceField(body.artist),
        album: sanitizePresenceField(body.album),
        updatedAt: Date.now(),
    });

    reply.code(204).send();
});

registerAliasedRoute('GET', '/api/nowplaying', { preHandler: requireAuth }, async (request) => {
    pruneStalePresence();
    const me = request.userRecord.user;
    const listeners = [];
    for (const info of presence.values()) {
        if (info.user === me) {
            continue;
        }
        listeners.push({
            user: info.user,
            track: info.track,
            artist: info.artist,
            album: info.album,
        });
    }
    listeners.sort((left, right) => left.user.localeCompare(right.user));
    return { listeners };
});

registerAliasedRoute('GET', '/api/admin/users', { preHandler: requireAdmin }, async () => {
    const users = await listUsers();
    return { users: users.map(sanitizeUser) };
});

registerAliasedRoute('POST', '/api/admin/users', { preHandler: requireAdmin }, async (request, reply) => {
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

registerAliasedRoute('PATCH', '/api/admin/users/:user', { preHandler: requireAdmin }, async (request, reply) => {
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

registerAliasedRoute('POST', '/api/admin/users/:user/reset', { preHandler: requireAdmin }, async (request, reply) => {
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

registerAliasedRoute('DELETE', '/api/admin/users/:user', { preHandler: requireAdmin }, async (request, reply) => {
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

registerAliasedRoute('GET', '/artist', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const artistList = await ensureArtistCache();
        reply.send({ artist_list: artistList });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load artists.' });
    }
});

registerAliasedRoute('GET', '/refresh-artist', { preHandler: requireAdmin }, async (request, reply) => {
    try {
        const artistList = await ensureArtistCache(true);
        reply.send({ artist_list: artistList });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to refresh artists.' });
    }
});

registerAliasedRoute('GET', '/album', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const artist = request.query.artist || request.headers.artist;
        const albums = await getFolders(artist);
        reply.send({ album_list: albums });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load albums.' });
    }
});

registerAliasedRoute('GET', '/tracks', { preHandler: requireAuth }, async (request, reply) => {
    try {
        const artist = request.query.artist || request.headers.artist;
        const album = request.query.album || request.headers.album;
        const tracks = await getFolders(artist, album, true);
        reply.send({ track_list: tracks });
    } catch (error) {
        reply.code(500).send({ error: 'Unable to load tracks.' });
    }
});

registerAliasedRoute('GET', '/track', { preHandler: requireAuth }, async (request, reply) => {
    const trackPath = request.query.path || request.headers.path;
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

        reply.header('Content-Type', getMimeType(trackPath)).send(result.buffer);
    } catch (error) {
        reply.code(500).send({ error: 'Failed to retrieve track.' });
    }
});

// ---------------------------------------------------------------------------
// Transcode endpoint — converts any audio format to fragmented MP4 / Opus
// so the browser can use MediaSource Extensions for seamless background
// playback on Firefox for Android.
//
// Returns a self-contained fMP4 blob (ftyp + moov + moof/mdat fragments).
// The client appends this into a persistent SourceBuffer.
// ---------------------------------------------------------------------------
registerAliasedRoute('GET', '/track/transcode', { preHandler: requireAuth }, async (request, reply) => {
    const trackPath = request.query.path || request.headers.path;

    if (!trackPath) {
        reply.code(400).send({ error: 'Missing path parameter.' });
        return;
    }

    // Ensure ffmpeg is available.
    if (!ffmpegAvailable) {
        reply.code(501).send({ error: 'Transcoding not available — ffmpeg not found on server.' });
        return;
    }

    try {
        // Check the disk cache first.
        const cached = getCachedTranscode(trackPath);
        if (cached) {
            reply.header('Content-Type', 'audio/mp4').header('Content-Length', cached.length).send(cached);
            return;
        }

        // Download the original file from Dropbox as a stream.
        const dbxResult = await getFileStream(trackPath);

        // Spawn ffmpeg: read audio from stdin, transcode to Opus in fMP4 container.
        // -movflags frag_keyframe+empty_moov+default_base_moof produces a proper
        // fragmented MP4 that the browser can ingest via MSE without seeking.
        const { spawn } = require('child_process');
        const ffmpeg = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            'pipe:0', // read from stdin
            '-vn', // drop any embedded art/video
            '-c:a',
            'aac', // AAC codec — most reliable for MSE across browsers
            '-b:a',
            '128k', // 128 kbps
            '-ar',
            '44100', // 44.1 kHz (standard for AAC)
            '-ac',
            '2', // stereo
            '-f',
            'mp4', // MP4 container
            '-movflags',
            'empty_moov+default_base_moof',
            '-frag_duration',
            '10000000', // 10-second fragments (microseconds) — ensures proper box sizes when piping
            'pipe:1', // write to stdout
        ]);

        // Pipe the Dropbox download stream into ffmpeg stdin.
        Readable.from(dbxResult.body)
            .pipe(ffmpeg.stdin)
            .on('error', () => {
                // Ignore EPIPE — ffmpeg may close stdin early on errors.
            });

        // Collect stderr for diagnostics (but don't expose to the client).
        let stderrChunks = [];
        ffmpeg.stderr.on('data', (chunk) => stderrChunks.push(chunk));

        // Wait for ffmpeg to finish and collect the full output.  We buffer
        // the entire result so the client gets a Content-Length and can create
        // a single Blob (needed for MSE preloading).
        const outputChunks = [];
        ffmpeg.stdout.on('data', (chunk) => outputChunks.push(chunk));

        await new Promise((resolve, reject) => {
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    const stderr = Buffer.concat(stderrChunks).toString().slice(0, 500);
                    reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
                }
            });
            ffmpeg.on('error', reject);
        });

        const outputBuffer = Buffer.concat(outputChunks);

        // Cache the transcoded result for future requests.
        setCachedTranscode(trackPath, outputBuffer);

        reply.header('Content-Type', 'audio/mp4').header('Content-Length', outputBuffer.length).send(outputBuffer);
    } catch (error) {
        console.error('Transcode error:', error?.message ?? error);
        reply.code(500).send({ error: 'Transcoding failed.' });
    }
});

registerAliasedRoute('GET', '/stream', async (request, reply) => {
    const trackPath = request.query.path;
    const token = request.query.token;

    if (!trackPath || !token) {
        reply.code(400).send({ error: 'Missing path or token parameter.' });
        return;
    }

    try {
        const decoded = fastify.jwt.verify(token);
        const user = await getUser(decoded.user);

        if (!user || !user.enabled) {
            reply.code(401).send({ error: 'Authentication required.' });
            return;
        }
    } catch (error) {
        reply.code(401).send({ error: 'Authentication required.' });
        return;
    }

    try {
        const range = request.headers.range;
        const contentType = getMimeType(trackPath);

        // MP4-container formats (m4a, aac, webm) need the moov atom to be
        // seekable. Buffer the full file so the browser can issue Range
        // requests against a known Content-Length.
        if (needsBuffering(trackPath)) {
            if (range) {
                // Serve a byte-range slice from Dropbox directly.
                const result = await getFileStream(trackPath, range);
                reply.header('Content-Type', contentType);
                reply.header('Accept-Ranges', 'bytes');
                reply.code(206);
                const contentRange = result.headers.get('content-range');
                const contentLength = result.headers.get('content-length');
                if (contentRange) reply.header('Content-Range', contentRange);
                if (contentLength) reply.header('Content-Length', contentLength);
                const nodeStream = result.body instanceof Readable ? result.body : Readable.fromWeb(result.body);
                return reply.send(nodeStream);
            }

            // No Range header — download the whole file and send as a buffer
            // so the browser learns the total size and can seek.
            const result = await getFile(trackPath);
            reply.header('Content-Type', contentType);
            reply.header('Accept-Ranges', 'bytes');
            reply.header('Content-Length', result.buffer.length);
            return reply.send(result.buffer);
        }

        // Streamable formats (mp3, flac, ogg, etc.) — pipe directly.
        const result = await getFileStream(trackPath, range);

        reply.header('Content-Type', contentType);
        reply.header('Accept-Ranges', 'bytes');

        if (result.status === 206) {
            const contentRange = result.headers.get('content-range');
            const contentLength = result.headers.get('content-length');
            reply.code(206);
            if (contentRange) reply.header('Content-Range', contentRange);
            if (contentLength) reply.header('Content-Length', contentLength);
        } else {
            const contentLength = result.headers.get('content-length');
            if (contentLength) reply.header('Content-Length', contentLength);
        }

        const nodeStream = result.body instanceof Readable ? result.body : Readable.fromWeb(result.body);
        return reply.send(nodeStream);
    } catch (error) {
        reply.code(500).send({ error: 'Failed to stream track.' });
    }
});

registerAliasedRoute('GET', '/track-info', { preHandler: requireAuth }, async (request, reply) => {
    const trackPath = request.query.path || request.headers.path;

    if (!trackPath) {
        reply.code(400).send({ error: 'Missing path header.' });
        return;
    }

    try {
        const fileInfo = await getFileInfo(trackPath);
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
