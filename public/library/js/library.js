const configuredApiBasePath = window.DropsonicRuntime?.apiBasePath;
const apiBasePath = typeof configuredApiBasePath === 'string' && configuredApiBasePath.trim() !== '' ? configuredApiBasePath : '../data';
const baseURL = new URL(`${apiBasePath.replace(/\/+$/u, '')}/`, window.location.href).toString();
const AUTH_TOKEN_KEY = 'dropsonic.authToken';
const nonMusicFileTypes = ['v1', 'txt', 'rar', 'm3u'];
const imageFileTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const fileTypesToExclude = [...nonMusicFileTypes, ...imageFileTypes];
const repeatModes = ['off', 'all', 'one'];

// Default artwork shown in the OS media notification when no album art is
// available. Firefox for Android requires a raster PNG (not SVG) to display
// the full lock-screen player with progress bar and skip controls.
function _buildDefaultArtworkUri() {
    try {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(size * 0.625)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('\u266a', size / 2, Math.round(size * 0.703));
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}
const DEFAULT_ARTWORK_URI = _buildDefaultArtworkUri();

const ICONS = {
    play: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 3.5v17l13-8.5z"/></svg>',
    pause: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="3" width="4.5" height="18" rx="1.2"/><rect x="14.5" y="3" width="4.5" height="18" rx="1.2"/></svg>',
    skipBack: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="4" width="2.5" height="16" rx=".8"/><path d="M21 3v18L8 12z"/></svg>',
    skipForward: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3v18l13-9z"/><rect x="19.5" y="4" width="2.5" height="16" rx=".8"/></svg>',
    repeat: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    repeatOne:
        '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-weight="700" font-family="system-ui">1</text></svg>',
    trash: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    plus: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    remove: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

const elements = {
    artistCount: document.getElementById('artist-count'),
    artistList: document.getElementById('artist-list'),
    artistNavigation: document.querySelectorAll('.artist-navigation'),
    artistSummary: document.getElementById('artist-summary'),
    artistSearch: document.getElementById('artist-search'),
    artistSearchClear: document.getElementById('artist-search-clear'),
    albumList: document.getElementById('album-list'),
    albumTitle: document.getElementById('album-title'),
    trackList: document.getElementById('track-list'),
    playList: document.getElementById('playlist'),
    playlistControls: document.getElementById('playlist-controls'),
    audioController: document.getElementById('audio-controller'),
    audioPreload: document.getElementById('audio-preload'),
    audioPlayToggle: document.getElementById('audio-play-toggle'),
    miniPlayToggle: document.getElementById('mini-play-toggle'),
    audioSeek: document.getElementById('audio-seek'),
    audioTime: document.getElementById('audio-time'),
    audioVolume: document.getElementById('audio-volume'),
    nowPlayingTitle: document.getElementById('np-title'),
    nowPlayingSub: document.getElementById('np-sub'),
    libraryUser: document.getElementById('library-user'),
    logoutButton: document.getElementById('library-logout'),
    topbar: document.getElementById('library-topbar'),
    presencePill: document.getElementById('presence-pill'),
    presencePillCount: document.getElementById('presence-pill-count'),
    presencePillList: document.getElementById('presence-pill-list'),
    artistSection: document.getElementById('artist-section'),
    collectionToggleLibrary: document.getElementById('collection-toggle-library'),
    collectionToggleIncoming: document.getElementById('collection-toggle-incoming'),
};

const state = {
    artists: [],
    albums: [],
    tracks: [],
    artistSearchQuery: '',
    selectedArtist: null,
    selectedAlbum: null,
    // Active browsing collection: 'library' (default, /music) or 'incoming' (/incoming).
    // The incoming collection mirrors the library hierarchy and lives in a parallel
    // state slice so switching collections preserves each side's selections.
    collection: 'library',
    incoming: {
        artists: [],
        albums: [],
        tracks: [],
        artistSearchQuery: '',
        selectedArtist: null,
        selectedAlbum: null,
        loaded: false,
    },
    playlist: [],
    currentIndex: -1,
    repeatMode: 'off',
    dragIndex: null,
    playlistTagHydrationInFlight: false,
    preloadedIndex: -1,
    // true only when the user explicitly clicked pause (vs. a system/browser pause)
    userPaused: false,
};

// Returns the state slice (artists/albums/tracks/selections/search) for the
// currently active collection. The library slice lives directly on `state` for
// backwards compatibility; the incoming slice is nested under `state.incoming`.
function activeView() {
    return state.collection === 'incoming' ? state.incoming : state;
}

// Prefix an API path with `incoming/` when the incoming collection is active.
function collectionApiPath(suffix) {
    return state.collection === 'incoming' ? `incoming/${suffix}` : suffix;
}

// Blob URLs for next-track preloading and the currently active track.
// Keeping these separate from `state` avoids serialisation surprises.
let preloadBlobUrl = null;
let preloadBlob = null; // actual Blob object (needed for .arrayBuffer() in MSE)
let preloadedDuration = null; // duration of preloaded track from audioPreload.loadedmetadata
let activeBlobUrl = null;

// Screen Wake Lock — held while audio is playing so the screen stays on and
// Firefox never applies its background-tab throttle (~5 s pause after src change).
let wakeLockSentinel = null;

async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) {
        return;
    }
    // Already held.
    if (wakeLockSentinel && !wakeLockSentinel.released) {
        return;
    }
    // Can only request while the document is visible.
    if (document.hidden) {
        return;
    }
    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
            console.log('Wake lock released');
        });
        console.log('Wake lock acquired');
    } catch (err) {
        // Permission denied or not supported — non-fatal
        console.warn('Wake lock request failed:', err?.message ?? err);
    }
}

function releaseWakeLock() {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
        wakeLockSentinel.release().catch(() => {});
    }
    wakeLockSentinel = null;
}

// ---------------------------------------------------------------------------
// MSE (MediaSource Extensions) engine — server-side transcoding to fMP4/Opus.
//
// Why: Firefox for Android fires `abort` + `emptied` whenever `audio.src` is
// reassigned — even without calling `.load()`. These events trigger a ~5-second
// background-tab grace-period timer that pauses playback. The only way to avoid
// this is to never change `audio.src` at a track boundary.
//
// How: the server transcodes any audio format to fragmented MP4 with Opus
// (via ffmpeg). We create one persistent MediaSource on the client, attach it
// as the sole `audio.src`, and append fMP4 data from each successive track
// into the SourceBuffer. The HTMLMediaElement sees one continuous stream and
// never gets an `abort` event.
//
// The first track's fMP4 is appended in full (init segment + media fragments).
// Subsequent tracks strip the init segment (ftyp + moov boxes) and append
// only the media fragments (moof + mdat), with an adjusted timestampOffset so
// they play right after the previous track ends.
// ---------------------------------------------------------------------------
const MSE_CODEC = 'audio/mp4; codecs="mp4a.40.2"';
const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'wav', 'aiff', 'aif', 'wma', 'webm']);

const mse = {
    active: false,
    mediaSource: null,
    sourceBuffer: null,
    objectUrl: null,
    _initSegment: null, // ArrayBuffer of the first track's init segment (ftyp + moov)
    // trackOffsets[i] = absolute MSE timeline start time (seconds) for playlist
    // index i. Track i occupies [trackOffsets[i], trackOffsets[i] + trackDurations[i]).
    trackOffsets: [],
    trackDurations: [],
    appendedUpTo: -1, // highest playlist index whose bytes are in the SourceBuffer
    _pendingAppend: -1, // playlist index currently being appended (guards against double-appends)
    _appendRetryTimer: null, // setInterval handle for retrying failed SourceBuffer appends
    _appendQueue: Promise.resolve(),

    isSupported() {
        return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(MSE_CODEC);
    },
    canHandle(trackPath) {
        const ext = String(trackPath || '')
            .split('.')
            .pop()
            .toLowerCase();
        return AUDIO_EXTENSIONS.has(ext);
    },

    // Returns true if the given playlist index has already been appended into
    // the SourceBuffer (either as the first track via init() or via appendNext()).
    isAppended(playlistIndex) {
        return this.active && this.appendedUpTo >= playlistIndex;
    },

    // Time within the current track (subtracting the track's start offset).
    currentTrackTime(audio) {
        if (!this.active) {
            return audio.currentTime;
        }
        const offset = this.trackOffsets[state.currentIndex] ?? 0;
        return Math.max(0, audio.currentTime - offset);
    },
    // Duration of the current track only.
    currentTrackDuration() {
        if (!this.active) {
            return elements.audioController.duration;
        }
        return this.trackDurations[state.currentIndex] ?? NaN;
    },
    // Seek within the current track.
    seek(trackTime) {
        const offset = this.trackOffsets[state.currentIndex] ?? 0;
        elements.audioController.currentTime = offset + Math.max(0, trackTime);
    },

    // -----------------------------------------------------------------------
    // _findInitEnd — parse fMP4 top-level boxes to find the byte offset where
    // the init segment (ftyp + moov) ends and media data (moof) begins.
    // fMP4 box layout: each box is [4-byte size (big-endian)] [4-byte type].
    //   size == 1 → extended size in the next 8 bytes (uint64).
    //   size == 0 → box extends to EOF (shouldn't happen for init boxes).
    // -----------------------------------------------------------------------
    _findInitEnd(ab) {
        const view = new DataView(ab);
        let offset = 0;
        while (offset + 8 <= ab.byteLength) {
            let boxSize = view.getUint32(offset);
            const boxType = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (boxSize === 1 && offset + 16 <= ab.byteLength) {
                // Extended size — read as two 32-bit halves (JS doesn't have
                // native uint64; files this large are unrealistic for init).
                boxSize = view.getUint32(offset + 8) * 0x100000000 + view.getUint32(offset + 12);
            }
            // If we've reached a moof box, the init segment ends here.
            // Check this BEFORE the size==0 bail-out — ffmpeg may write the
            // last moof with size 0 ("extends to EOF") when piping to stdout.
            if (boxType === 'moof') {
                return offset;
            }
            if (boxSize === 0) {
                // Box extends to end of file — treat everything as init.
                return ab.byteLength;
            }
            offset += boxSize;
        }
        // No moof found — entire buffer is init (shouldn't happen).
        return ab.byteLength;
    },

    // -----------------------------------------------------------------------
    // init — called once for the very first track when MSE is used.
    // Creates a fresh MediaSource, sets audio.src, and appends the first fMP4
    // blob in full (init segment + media fragments).
    // -----------------------------------------------------------------------
    async init(blob, duration, playlistIndex) {
        this.teardown();

        this.mediaSource = new MediaSource();
        this.objectUrl = URL.createObjectURL(this.mediaSource);
        elements.audioController.src = this.objectUrl;

        await new Promise((resolve, reject) => {
            const onOpen = () => {
                this.mediaSource.removeEventListener('sourceopen', onOpen);
                this.mediaSource.removeEventListener('error', onErr);
                resolve();
            };
            const onErr = (e) => {
                this.mediaSource.removeEventListener('sourceopen', onOpen);
                this.mediaSource.removeEventListener('error', onErr);
                reject(e);
            };
            this.mediaSource.addEventListener('sourceopen', onOpen, { once: true });
            this.mediaSource.addEventListener('error', onErr, { once: true });
        });

        this.sourceBuffer = this.mediaSource.addSourceBuffer(MSE_CODEC);
        this.trackOffsets = [];
        this.trackDurations = [];
        this.appendedUpTo = -1;
        this._appendQueue = Promise.resolve();
        this.active = true;

        const ab = await blob.arrayBuffer();

        // Store the init segment so we can skip it when appending later tracks.
        const initEnd = this._findInitEnd(ab);
        this._initSegment = ab.slice(0, initEnd);

        // Diagnostic: log the top-level fMP4 box structure so we can verify
        // that the transcode output is properly fragmented.
        {
            const dv = new DataView(ab);
            let off = 0;
            const boxes = [];
            while (off + 8 <= ab.byteLength && boxes.length < 20) {
                let sz = dv.getUint32(off);
                const tp = String.fromCharCode(dv.getUint8(off + 4), dv.getUint8(off + 5), dv.getUint8(off + 6), dv.getUint8(off + 7));
                if (sz === 1 && off + 16 <= ab.byteLength) {
                    sz = dv.getUint32(off + 8) * 0x100000000 + dv.getUint32(off + 12);
                }
                boxes.push(`${tp}@${off}(${sz})`);
                if (sz === 0) break;
                off += sz;
            }
            console.log(`mse.init: fMP4 boxes: ${boxes.join(' ')}`);
        }
        console.log(`mse.init: initSegment=${initEnd} bytes, total=${ab.byteLength} bytes`);

        await this._appendBuffer(ab, playlistIndex, 0);
    },

    // -----------------------------------------------------------------------
    // appendNext — called at track-boundary time to seamlessly append the next
    // track's media fragments into the existing SourceBuffer.
    // Strips the init segment (ftyp + moov) so the SourceBuffer doesn't see
    // a duplicate initialisation — only moof+mdat pairs are appended.
    // -----------------------------------------------------------------------
    async appendNext(blob, duration, playlistIndex) {
        // Guard against double-appends from concurrent calls.
        if (this.isAppended(playlistIndex) || this._pendingAppend === playlistIndex) {
            console.log(`mse.appendNext: track ${playlistIndex} already appended or in-flight — skipping`);
            return this._appendQueue;
        }
        this._pendingAppend = playlistIndex;
        try {
            const prevIndex = playlistIndex - 1;
            const prevOffset = prevIndex >= 0 ? (this.trackOffsets[prevIndex] ?? 0) : 0;
            const prevDuration = prevIndex >= 0 ? (this.trackDurations[prevIndex] ?? 0) : 0;
            const startOffset = prevOffset + prevDuration;

            const fullAb = await blob.arrayBuffer();
            const initEnd = this._findInitEnd(fullAb);
            const mediaOnly = fullAb.slice(initEnd);
            console.log(`mse.appendNext: stripped ${initEnd} init bytes, appending ${mediaOnly.byteLength} media bytes at offset ${startOffset.toFixed(2)}`);

            await this._appendBuffer(mediaOnly, playlistIndex, startOffset);

            // Append succeeded — clear the retry timer if one was running.
            if (this._appendRetryTimer !== null) {
                clearInterval(this._appendRetryTimer);
                this._appendRetryTimer = null;
            }
        } finally {
            // Always reset so subsequent calls are not permanently blocked.
            this._pendingAppend = -1;
        }
    },

    // -----------------------------------------------------------------------
    // _appendBuffer — low-level append with timestampOffset.
    // Evicts consumed data before appending to reclaim SourceBuffer quota.
    // On QuotaExceededError, evicts more aggressively and retries once.
    // On any error the queue chain is reset so future appends are unblocked.
    // -----------------------------------------------------------------------
    _appendBuffer(arrayBuffer, playlistIndex, timestampOffset) {
        this._appendQueue = this._appendQueue
            .then(async () => {
                if (!this.active || !this.sourceBuffer) {
                    return;
                }
                // Evict data consumed more than 5 s ago to reclaim quota before
                // attempting the append. This is especially important on mobile
                // where the SourceBuffer quota can be as low as ~12 MB.
                await this._evictAsync(elements.audioController.currentTime - 5);

                await this._waitReady();
                this.sourceBuffer.timestampOffset = timestampOffset;

                try {
                    this.sourceBuffer.appendBuffer(arrayBuffer);
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
                        // Evict everything consumed up to the current playhead
                        // and retry once — the first evict pass may not have
                        // freed enough space if the keepback window was small.
                        console.warn('mse._appendBuffer: QuotaExceededError — evicting to playhead and retrying');
                        await this._evictAsync(elements.audioController.currentTime);
                        await this._waitReady();
                        this.sourceBuffer.appendBuffer(arrayBuffer);
                    } else {
                        throw err;
                    }
                }

                await this._waitReady();
                // Record the offset we promised for this track.
                this.trackOffsets[playlistIndex] = timestampOffset;
                // Derive actual duration from what was buffered (most accurate).
                const buffered = this.sourceBuffer.buffered;
                let bufferedEnd = timestampOffset;
                for (let i = 0; i < buffered.length; i++) {
                    if (buffered.end(i) > bufferedEnd) {
                        bufferedEnd = buffered.end(i);
                    }
                }
                this.trackDurations[playlistIndex] = bufferedEnd - timestampOffset;
                this.appendedUpTo = playlistIndex;
                console.log(
                    `mse._appendBuffer: track ${playlistIndex} offset=${timestampOffset.toFixed(2)} dur=${this.trackDurations[playlistIndex]?.toFixed(2)} bufferedEnd=${bufferedEnd.toFixed(2)}`,
                );
            })
            .catch((err) => {
                // Reset the queue chain so future _appendBuffer calls are not
                // permanently blocked by this rejection.
                this._appendQueue = Promise.resolve();
                return Promise.reject(err);
            });
        return this._appendQueue;
    },

    _waitReady() {
        return new Promise((resolve) => {
            if (!this.sourceBuffer || !this.sourceBuffer.updating) {
                resolve();
                return;
            }
            this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
        });
    },

    // Asynchronously remove buffered data before `upToTime` to reclaim quota.
    // Only one remove() operation runs at a time; awaits updateend before returning.
    async _evictAsync(upToTime) {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }
        const cutoff = Math.max(0, upToTime);
        const buffered = this.sourceBuffer.buffered;
        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if (start < cutoff) {
                const removeEnd = Math.min(cutoff, end);
                if (removeEnd > start) {
                    this.sourceBuffer.remove(start, removeEnd);
                    await this._waitReady();
                    return; // one range per call
                }
            }
        }
    },

    // Clean up everything and release the object URL.
    teardown() {
        this.active = false;
        this._appendQueue = Promise.resolve();
        this._initSegment = null;
        this._pendingAppend = -1;
        if (this._appendRetryTimer !== null) {
            clearInterval(this._appendRetryTimer);
            this._appendRetryTimer = null;
        }
        try {
            if (this.mediaSource) {
                if (this.mediaSource.readyState === 'open') {
                    this.mediaSource.endOfStream();
                }
            }
        } catch {
            /* ignore */
        }
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.trackOffsets = [];
        this.trackDurations = [];
        this.appendedUpTo = -1;
    },
};

const tagCache = new Map();

function redirectToLogin() {
    window.location.replace('../login/');
}

function getAuthToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function buildAuthHeaders(headers = {}) {
    const token = getAuthToken();

    if (!token) {
        redirectToLogin();
        throw new Error('Missing auth token');
    }

    return {
        ...headers,
        Authorization: `Bearer ${token}`,
    };
}

function buildUrl(path, params = {}) {
    const url = new URL(path, baseURL);

    Object.entries(params).forEach(([key, value]) => {
        if (value != null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

function buildStreamUrl(trackPath) {
    const token = getAuthToken();

    if (!token) {
        redirectToLogin();
        throw new Error('Missing auth token');
    }

    return buildUrl('stream', { path: trackPath, token });
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: buildAuthHeaders(options.headers || {}),
    });

    if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        redirectToLogin();
        throw new Error('Unauthorized');
    }

    if (!response.ok && response.status !== 206) {
        let errorMessage = `Request failed: ${response.status}`;

        try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
        } catch {
            // ignore json parse errors
        }

        throw new Error(errorMessage);
    }

    return response;
}

async function apiGetJson(path, params = {}) {
    const response = await apiFetch(buildUrl(path, params));
    return response.json();
}

function normalizeArtistName(name) {
    return String(name || '')
        .trim()
        .toUpperCase()
        .replace(/^THE\s+/u, '');
}

function stripExtension(name) {
    const text = String(name || '').trim();
    return text.replace(/\.[^.]+$/u, '');
}

function naturalCompare(left, right) {
    return String(left || '').localeCompare(String(right || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

function isVisibleMediaEntry(entry) {
    const name = String(entry?.name || '');
    const fileType = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

    return name && !name.startsWith('.') && !fileTypesToExclude.includes(fileType);
}

function parseTrackNumber(value) {
    if (value == null || value === '') {
        return null;
    }

    const match = String(value).match(/(\d{1,3})/u);
    return match ? parseInt(match[1], 10) : null;
}

function getTrackNumber(track) {
    return track?._tags?.trackNo ?? parseTrackNumber(stripExtension(track?.name).replace(/^0+/u, ''));
}

function getAlbumYear(album) {
    const match = String(album?.name || '').match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/u);
    return match ? parseInt(match[1], 10) : null;
}

function getTrackTitle(track) {
    return track?._tags?.title?.trim() || stripExtension(track?.name) || 'Unknown track';
}

function getTrackArtist(track, fallbackArtist = '') {
    return track?._tags?.artist?.trim() || fallbackArtist || '';
}

function getTrackAlbum(track, fallbackAlbum = '') {
    return track?._tags?.album?.trim() || fallbackAlbum || '';
}

function sortArtists(artists) {
    return [...artists].filter((artist) => artist['.tag'] === 'folder').sort((left, right) => naturalCompare(normalizeArtistName(left.name), normalizeArtistName(right.name)));
}

function sortAlbums(albums) {
    return [...albums]
        .filter((album) => album['.tag'] === 'folder' && isVisibleMediaEntry(album))
        .sort((left, right) => {
            const leftYear = getAlbumYear(left);
            const rightYear = getAlbumYear(right);

            if (leftYear != null && rightYear != null && leftYear !== rightYear) {
                return leftYear - rightYear;
            }

            if (leftYear != null && rightYear == null) {
                return -1;
            }

            if (leftYear == null && rightYear != null) {
                return 1;
            }

            return naturalCompare(left.name, right.name);
        });
}

function sortTracks(tracks) {
    return [...tracks]
        .filter((track) => track['.tag'] === 'file' && isVisibleMediaEntry(track))
        .sort((left, right) => {
            const leftNumber = getTrackNumber(left);
            const rightNumber = getTrackNumber(right);

            if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) {
                return leftNumber - rightNumber;
            }

            if (leftNumber != null && rightNumber == null) {
                return -1;
            }

            if (leftNumber == null && rightNumber != null) {
                return 1;
            }

            return naturalCompare(stripExtension(left.name), stripExtension(right.name));
        });
}

function createMiniButton(icon, ariaLabel, onClick, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mini-button ${extraClass}`.trim();
    button.innerHTML = icon;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
    });
    return button;
}

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function syncStickyOffsets() {
    const topbarHeight = elements.topbar ? Math.ceil(elements.topbar.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--library-topbar-height', `${topbarHeight}px`);
}

function setExpandedSection(sectionId) {
    const isDesktop = window.matchMedia('(min-width: 992px)').matches;
    const sections = document.querySelectorAll('#media-picker > .section-panel');
    if (isDesktop) {
        // On desktop only the media-player toggles
        const player = document.getElementById('media-player');
        if (sectionId === 'media-player' || sectionId === null) {
            player.classList.toggle('section-expanded', sectionId === 'media-player');
        }
        return;
    }
    sections.forEach((section) => {
        section.classList.toggle('section-expanded', section.id === sectionId);
    });
}

function initAccordion() {
    const headerMap = [
        { header: document.getElementById('collection-summary'), section: 'artist-section' },
        { header: document.getElementById('artist-summary'), section: 'album-section' },
        { header: document.querySelector('#track-section .title-container'), section: 'track-section' },
        { header: document.getElementById('control-container'), section: 'media-player' },
    ];

    headerMap.forEach(({ header, section }) => {
        if (!header) return;
        header.addEventListener('click', (e) => {
            if (section === 'media-player' && e.target.closest('button, input, .audio-btn, .mini-transport')) return;
            if (section === 'artist-section' && e.target.closest('.letter-link, .artist-navigation, input, button')) return;
            const panel = document.getElementById(section);
            if (panel) {
                setExpandedSection(panel.classList.contains('section-expanded') ? null : section);
            }
        });
    });

    setExpandedSection('artist-section');
}

function setEmptyState(element, message) {
    clearElement(element);
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = message;
    element.append(empty);
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatPlaybackTime(seconds) {
    return formatDuration(seconds) || '0:00';
}

function updateAudioControls() {
    const currentTime = mse.active ? mse.currentTrackTime(elements.audioController) : elements.audioController.currentTime;
    const duration = mse.active ? mse.currentTrackDuration() : elements.audioController.duration;
    const hasDuration = Number.isFinite(duration) && duration > 0;

    if (elements.audioSeek) {
        elements.audioSeek.value = hasDuration ? String((currentTime / duration) * 100) : '0';
    }

    if (elements.audioTime) {
        elements.audioTime.textContent = `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`;
    }

    if (elements.audioPlayToggle) {
        const isPaused = elements.audioController.paused;
        elements.audioPlayToggle.innerHTML = isPaused ? ICONS.play : ICONS.pause;
        elements.audioPlayToggle.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
        elements.audioPlayToggle.title = isPaused ? 'Play' : 'Pause';
    }

    if (elements.miniPlayToggle) {
        const isPaused = elements.audioController.paused;
        elements.miniPlayToggle.innerHTML = isPaused ? ICONS.play : ICONS.pause;
        elements.miniPlayToggle.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
        elements.miniPlayToggle.title = isPaused ? 'Play' : 'Pause';
    }
}

function initializeCustomAudioControls() {
    if (elements.audioVolume) {
        elements.audioController.volume = Number(elements.audioVolume.value || 1);
        elements.audioVolume.addEventListener('input', (event) => {
            const nextVolume = Number(event.target.value);
            elements.audioController.volume = Number.isFinite(nextVolume) ? nextVolume : 1;
        });
    }

    if (elements.audioPlayToggle) {
        elements.audioPlayToggle.addEventListener('click', async () => {
            if (elements.audioController.paused) {
                state.userPaused = false;
                try {
                    await elements.audioController.play();
                } catch {
                    // autoplay restrictions may block play
                }
            } else {
                state.userPaused = true;
                elements.audioController.pause();
            }
            updateAudioControls();
        });
    }

    if (elements.miniPlayToggle) {
        elements.miniPlayToggle.addEventListener('click', async () => {
            if (elements.audioController.paused) {
                state.userPaused = false;
                try {
                    await elements.audioController.play();
                } catch {
                    // autoplay restrictions may block play
                }
            } else {
                state.userPaused = true;
                elements.audioController.pause();
            }
            updateAudioControls();
        });
    }

    if (elements.audioSeek) {
        elements.audioSeek.addEventListener('input', (event) => {
            const duration = mse.active ? mse.currentTrackDuration() : elements.audioController.duration;
            if (!Number.isFinite(duration) || duration <= 0) {
                return;
            }

            const ratio = Number(event.target.value) / 100;
            if (mse.active) {
                mse.seek(ratio * duration);
            } else {
                elements.audioController.currentTime = Math.max(0, Math.min(duration, duration * ratio));
            }
            updateAudioControls();
        });
    }

    elements.audioController.addEventListener('timeupdate', () => {
        updateAudioControls();
        updateMediaSessionPositionState();
    });
    elements.audioController.addEventListener('loadedmetadata', () => {
        updateAudioControls();
        updateMediaSessionPositionState();
    });
    elements.audioController.addEventListener('play', () => {
        updateAudioControls();
        updateMediaSessionPositionState();
        acquireWakeLock();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });
    elements.audioController.addEventListener('pause', () => {
        updateAudioControls();
        // Only release the wake lock when the user has deliberately paused,
        // or when the track actually ended (the ended event fires just before
        // this). Don't release mid-track on a transient external pause.
        if (state.userPaused || elements.audioController.ended) {
            releaseWakeLock();
        }
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    });
    elements.audioController.addEventListener('emptied', updateAudioControls);

    updateAudioControls();
}

function normalizeTextForCompare(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, ' ')
        .trim();
}

function isRedundantText(value, comparisons = []) {
    const normalizedValue = normalizeTextForCompare(value);

    if (!normalizedValue) {
        return true;
    }

    return comparisons
        .map((entry) => normalizeTextForCompare(entry))
        .filter(Boolean)
        .some((entry) => entry.includes(normalizedValue) || normalizedValue.includes(entry));
}

function setNowPlayingText(el, text) {
    el.textContent = '';
    el.classList.remove('scrolling');
    el.style.removeProperty('--scroll-dist');
    el.style.removeProperty('--scroll-duration');
    const inner = document.createElement('span');
    inner.className = 'np-scroll-inner';
    inner.textContent = text;
    el.appendChild(inner);
}

function applyNowPlayingScroll() {
    // Cancel any pending scroll check from a previous call
    if (applyNowPlayingScroll._raf) {
        cancelAnimationFrame(applyNowPlayingScroll._raf);
    }

    applyNowPlayingScroll._raf = requestAnimationFrame(() => {
        applyNowPlayingScroll._raf = requestAnimationFrame(() => {
            applyNowPlayingScroll._raf = null;

            [elements.nowPlayingTitle, elements.nowPlayingSub].forEach((el) => {
                el.classList.remove('scrolling');
                el.style.removeProperty('--scroll-dist');
                el.style.removeProperty('--scroll-duration');

                // el is a block div with overflow:hidden — scrollWidth = full content width
                const overflow = el.scrollWidth - el.clientWidth;

                if (overflow > 1) {
                    const duration = Math.max(6, overflow / 30 + 4);
                    el.style.setProperty('--scroll-dist', `-${overflow}px`);
                    el.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
                    el.classList.add('scrolling');
                }
            });
        });
    });
}

function updateNowPlaying(item = null) {
    // Report presence on every now-playing change. The reporter throttles
    // duplicate payloads and silently no-ops on transient network errors.
    try {
        reportPresence(item);
    } catch (err) {
        console.warn('reportPresence threw:', err?.message ?? err);
    }

    if (!item) {
        setNowPlayingText(elements.nowPlayingTitle, '—');
        setNowPlayingText(elements.nowPlayingSub, '—');
        return;
    }

    const title = getTrackTitle(item.track);
    const artist = getTrackArtist(item.track, item.artist.name);
    const album = getTrackAlbum(item.track, item.album.name);
    const subtitleParts = [];

    if (!isRedundantText(artist, [title])) {
        subtitleParts.push(artist);
    }

    if (!isRedundantText(album, [title, artist])) {
        subtitleParts.push(album);
    }

    const metadataParts = [];
    const metadataSet = new Set();
    const addMetadataPart = (value) => {
        const text = String(value || '').trim();

        if (!text) {
            return;
        }

        const normalized = normalizeTextForCompare(text);
        if (!normalized || metadataSet.has(normalized)) {
            return;
        }

        metadataSet.add(normalized);
        metadataParts.push(text);
    };

    if (item.track?._tags?.year) {
        addMetadataPart(String(item.track._tags.year));
    }

    const contextText = subtitleParts.join(' — ');
    const detailText = metadataParts.join(' • ');

    setNowPlayingText(elements.nowPlayingTitle, title);
    setNowPlayingText(elements.nowPlayingSub, [contextText, detailText].filter(Boolean).join(' • ') || artist || album || detailText || 'Tag details pending…');

    applyNowPlayingScroll();

    elements.audioController.title = `Now playing: ${title}`;
    elements.audioController.setAttribute('aria-label', `Now playing: ${title}`);
}

async function hydratePlaylistTrackTags() {
    if (state.playlistTagHydrationInFlight || state.playlist.length === 0) {
        return;
    }

    const tracksMissingTags = state.playlist.map((item) => item.track).filter((track) => track && !track._tags);

    if (tracksMissingTags.length === 0) {
        return;
    }

    state.playlistTagHydrationInFlight = true;

    try {
        await mapLimit(tracksMissingTags, 4, async (track) => {
            try {
                track._tags = await getTagsFast(track);
            } catch (error) {
                console.warn('Playlist tag read failed:', track?.name, error);
            }
        });

        renderPlaylist();

        if (state.currentIndex >= 0) {
            updateNowPlaying(state.playlist[state.currentIndex]);
        }
    } finally {
        state.playlistTagHydrationInFlight = false;
    }
}

function readTagsFromBlob(blob) {
    return new Promise((resolve, reject) => {
        jsmediatags.read(blob, {
            onSuccess: (tag) => resolve(tag?.tags || {}),
            onError: reject,
        });
    });
}

async function getTagsFast(track) {
    const key = track.path_lower || track.name;

    if (tagCache.has(key)) {
        return tagCache.get(key);
    }

    const pending = (async () => {
        const response = await apiFetch(buildUrl('track', { path: track.path_lower }), {
            method: 'GET',
            headers: {
                Range: 'bytes=0-262143',
            },
        });

        const blob = await response.blob();
        const tags = await readTagsFromBlob(blob);

        return {
            ...tags,
            trackNo: parseTrackNumber(tags.track),
        };
    })().catch((error) => {
        tagCache.delete(key);
        throw error;
    });

    tagCache.set(key, pending);
    return pending;
}

async function mapLimit(items, limit, fn) {
    const executing = new Set();
    const results = [];

    for (const item of items) {
        const task = Promise.resolve().then(() => fn(item));
        results.push(task);
        executing.add(task);
        task.finally(() => executing.delete(task));

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.allSettled(results);
}

function updateRepeatButton(button) {
    const states = {
        off: {
            label: 'Repeat off',
            icon: ICONS.repeat,
        },
        all: {
            label: 'Repeat all',
            icon: ICONS.repeat,
        },
        one: {
            label: 'Repeat one',
            icon: ICONS.repeatOne,
        },
    };

    const current = states[state.repeatMode] || states.off;
    button.querySelector('span').innerHTML = current.icon;
    button.setAttribute('aria-label', current.label);
    button.title = current.label;
    button.classList.toggle('repeat-mode-active', state.repeatMode !== 'off');
}

function createPlaylistControls() {
    clearElement(elements.playlistControls);

    const previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'control icon-control';
    previousButton.innerHTML = `<span aria-hidden="true">${ICONS.skipBack}</span>`;
    previousButton.setAttribute('aria-label', 'Previous');
    previousButton.title = 'Previous';
    previousButton.addEventListener('click', () => previousTrack());

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'control icon-control';
    nextButton.innerHTML = `<span aria-hidden="true">${ICONS.skipForward}</span>`;
    nextButton.setAttribute('aria-label', 'Next');
    nextButton.title = 'Next';
    nextButton.addEventListener('click', () => nextTrack());

    const repeatButton = document.createElement('button');
    repeatButton.type = 'button';
    repeatButton.className = 'control icon-control';
    repeatButton.innerHTML = '<span aria-hidden="true"></span>';
    repeatButton.addEventListener('click', () => {
        const currentIndex = repeatModes.indexOf(state.repeatMode);
        state.repeatMode = repeatModes[(currentIndex + 1) % repeatModes.length];
        updateRepeatButton(repeatButton);
    });
    updateRepeatButton(repeatButton);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'control icon-control';
    clearButton.innerHTML = `<span aria-hidden="true">${ICONS.trash}</span>`;
    clearButton.setAttribute('aria-label', 'Clear playlist');
    clearButton.title = 'Clear playlist';
    clearButton.addEventListener('click', () => clearPlaylist());

    elements.playlistControls.append(previousButton, nextButton, repeatButton, clearButton);
}

function renderArtists() {
    clearElement(elements.artistList);
    elements.artistNavigation.forEach((node) => clearElement(node));

    const view = activeView();
    const artists = sortArtists(view.artists);
    const searchQuery = String(view.artistSearchQuery || '')
        .trim()
        .toLowerCase();
    const filteredArtists = artists.filter((artist) => {
        const artistName = String(artist?.name || '');
        const searchMatches = !searchQuery || artistName.toLowerCase().includes(searchQuery);
        return searchMatches;
    });

    const table = document.createElement('table');
    const body = document.createElement('tbody');
    const letterTargets = new Map();
    const assortedRows = [];
    const hasAssortedMatches = filteredArtists.some((artist) => {
        const firstChar = normalizeArtistName(artist.name).slice(0, 1) || '@';
        return !/^[A-Z]$/u.test(firstChar);
    });
    const availableShortcuts = new Set();

    if (hasAssortedMatches) {
        availableShortcuts.add('@');
    }

    const countText = filteredArtists.length === artists.length ? `Artists (${artists.length})` : `Artists (${filteredArtists.length}/${artists.length})`;
    elements.artistCount.textContent = countText;
    if (elements.artistSearchClear) {
        elements.artistSearchClear.classList.toggle('hidden', searchQuery.length === 0);
    }
    table.className = 'table table-hover';

    filteredArtists.forEach((artist) => {
        const displayLetter = normalizeArtistName(artist.name).slice(0, 1) || '@';
        if (/^[A-Z]$/u.test(displayLetter)) {
            availableShortcuts.add(displayLetter);
        }
    });

    const shortcuts = Array.from(availableShortcuts).sort((left, right) => {
        if (left === '@') {
            return -1;
        }
        if (right === '@') {
            return 1;
        }
        return naturalCompare(left, right);
    });

    const firstRowCount = Math.floor(shortcuts.length / 2);

    shortcuts.forEach((shortcut, index) => {
        const link = document.createElement('div');
        link.className = 'letter-link';
        link.textContent = shortcut;
        link.addEventListener('click', () => {
            const targetId = shortcut === '@' ? 'shortcut-assorted' : `shortcut-${shortcut}`;
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        const targetNav = index >= firstRowCount ? elements.artistNavigation[1] : elements.artistNavigation[0];
        targetNav.append(link);
    });

    if (filteredArtists.length === 0) {
        setEmptyState(elements.artistList, 'No artists match the current filters.');
        return;
    }

    let assortedShortcutRow = null;
    if (hasAssortedMatches) {
        assortedShortcutRow = document.createElement('tr');
        assortedShortcutRow.className = 'artist-list-shortcut';
        assortedShortcutRow.id = 'shortcut-assorted';
        const assortedShortcutCell = document.createElement('td');
        assortedShortcutCell.textContent = 'Assorted';
        assortedShortcutRow.append(assortedShortcutCell);
    }

    filteredArtists.forEach((artist) => {
        const displayLetter = normalizeArtistName(artist.name).slice(0, 1) || '@';
        const isLetter = /^[A-Z]$/u.test(displayLetter);

        if (isLetter && !letterTargets.has(displayLetter)) {
            const shortcutRow = document.createElement('tr');
            shortcutRow.className = 'artist-list-shortcut';
            shortcutRow.id = `shortcut-${displayLetter}`;
            const shortcutCell = document.createElement('td');
            shortcutCell.textContent = displayLetter;
            shortcutRow.append(shortcutCell);
            body.append(shortcutRow);
            letterTargets.set(displayLetter, shortcutRow);
        }

        const row = document.createElement('tr');
        row.className = 'artist-row';
        row.addEventListener('click', () => loadAlbums(artist));

        const cell = document.createElement('td');
        cell.textContent = artist.name;
        row.append(cell);

        if (isLetter) {
            body.append(row);
        } else {
            assortedRows.push(row);
        }
    });

    if (assortedShortcutRow && assortedRows.length > 0) {
        body.prepend(assortedShortcutRow, ...assortedRows);
    }
    table.append(body);
    elements.artistList.append(table);
}

function renderAlbums() {
    clearElement(elements.albumList);

    const view = activeView();
    if (!view.selectedArtist) {
        elements.artistSummary.textContent = 'Artist: Select an artist';
        setEmptyState(elements.albumList, 'Albums will appear here.');
        return;
    }

    const table = document.createElement('table');
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const playHeader = document.createElement('th');
    const addHeader = document.createElement('th');
    const albumHeader = document.createElement('th');
    const body = document.createElement('tbody');

    playHeader.className = 'action-cell';
    addHeader.className = 'action-cell';
    playHeader.innerHTML = ICONS.play;
    addHeader.innerHTML = ICONS.plus;
    albumHeader.textContent = 'Album';
    headerRow.append(playHeader, addHeader, albumHeader);
    header.append(headerRow);

    elements.artistSummary.textContent = `Artist: ${view.selectedArtist.name}`;
    table.className = 'table table-hover';

    view.albums.forEach((album) => {
        const row = document.createElement('tr');
        row.className = 'album-row';
        row.addEventListener('click', () => loadTracks(view.selectedArtist, album));

        const playCell = document.createElement('td');
        playCell.className = 'action-cell';
        playCell.append(createMiniButton(ICONS.play, `Play ${album.name}`, () => queueAlbum(view.selectedArtist, album, true)));

        const addCell = document.createElement('td');
        addCell.className = 'action-cell';
        addCell.append(createMiniButton(ICONS.plus, `Add ${album.name}`, () => queueAlbum(view.selectedArtist, album, false)));

        const nameCell = document.createElement('td');
        const albumName = document.createElement('div');
        albumName.className = 'album-title-text';
        albumName.textContent = album.name;
        nameCell.append(albumName);

        const year = getAlbumYear(album);
        if (year != null) {
            const hint = document.createElement('div');
            hint.className = 'album-year-hint';
            hint.textContent = `${year}`;
            nameCell.append(hint);
        }

        row.append(playCell, addCell, nameCell);
        body.append(row);
    });

    if (view.albums.length === 0) {
        setEmptyState(elements.albumList, 'No albums found for this artist.');
        return;
    }

    table.append(header, body);
    elements.albumList.append(table);
}

function renderTracks() {
    clearElement(elements.trackList);

    const view = activeView();
    if (!view.selectedAlbum) {
        elements.albumTitle.textContent = 'Album: Select an album';
        setEmptyState(elements.trackList, 'Tracks will appear here.');
        return;
    }

    elements.albumTitle.textContent = `Album: ${view.selectedAlbum.name}`;

    const table = document.createElement('table');
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const numberHeader = document.createElement('th');
    const playHeader = document.createElement('th');
    const addHeader = document.createElement('th');
    const titleHeader = document.createElement('th');
    const body = document.createElement('tbody');
    const rowByPath = new Map();

    numberHeader.textContent = '#';
    numberHeader.className = 'track-number-cell';
    playHeader.innerHTML = ICONS.play;
    playHeader.className = 'action-cell';
    addHeader.innerHTML = ICONS.plus;
    addHeader.className = 'action-cell';
    titleHeader.textContent = 'Title';
    headerRow.append(numberHeader, playHeader, addHeader, titleHeader);
    header.append(headerRow);
    table.className = 'table table-hover';

    view.tracks.forEach((track, index) => {
        const row = document.createElement('tr');
        row.className = 'track-row';

        const numberCell = document.createElement('td');
        numberCell.className = 'track-number-cell';
        numberCell.textContent = getTrackNumber(track) ?? index + 1;

        const playCell = document.createElement('td');
        playCell.className = 'action-cell';
        playCell.append(createMiniButton(ICONS.play, `Play ${track.name}`, () => playTracks([track], view.selectedArtist, view.selectedAlbum)));

        const addCell = document.createElement('td');
        addCell.className = 'action-cell';
        addCell.append(createMiniButton(ICONS.plus, `Add ${track.name}`, () => enqueueTrack(view.selectedArtist, view.selectedAlbum, track)));

        const titleCell = document.createElement('td');
        const title = document.createElement('div');
        title.className = 'track-title';
        title.textContent = getTrackTitle(track);
        titleCell.append(title);

        row.append(numberCell, playCell, addCell, titleCell);
        body.append(row);
        rowByPath.set(track.path_lower || track.name, { title, numberCell });
    });

    table.append(header, body);
    elements.trackList.append(table);

    mapLimit(view.tracks, 4, async (track) => {
        const key = track.path_lower || track.name;
        const refs = rowByPath.get(key);
        if (!refs) {
            return;
        }

        try {
            track._tags = await getTagsFast(track);

            if (!refs.title.isConnected) {
                return;
            }

            refs.title.textContent = getTrackTitle(track);
            refs.numberCell.textContent = getTrackNumber(track) ?? refs.numberCell.textContent;
            renderPlaylist();

            if (state.currentIndex >= 0) {
                updateNowPlaying(state.playlist[state.currentIndex]);
            }
        } catch (error) {
            console.warn('Tag read failed:', track?.name, error);
        }
    });
}

function renderPlaylist() {
    clearElement(elements.playList);

    if (state.playlist.length === 0) {
        setEmptyState(elements.playList, 'Playlist is empty. Use the add buttons to queue tracks.');
        return;
    }

    const table = document.createElement('table');
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const dragHeader = document.createElement('th');
    const numberHeader = document.createElement('th');
    const titleHeader = document.createElement('th');
    const artistHeader = document.createElement('th');
    const albumHeader = document.createElement('th');
    const removeHeader = document.createElement('th');
    const body = document.createElement('tbody');

    dragHeader.className = 'playlist-drag-cell';
    numberHeader.className = 'playlist-order-cell';
    removeHeader.className = 'playlist-remove-cell';
    numberHeader.textContent = '#';
    titleHeader.textContent = 'Title';
    artistHeader.textContent = 'Artist';
    albumHeader.textContent = 'Album';
    removeHeader.textContent = '';
    headerRow.append(dragHeader, numberHeader, titleHeader, artistHeader, albumHeader, removeHeader);
    header.append(headerRow);
    table.className = 'table table-hover';

    state.playlist.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'track-row';
        row.draggable = true;
        row.classList.toggle('playing', index === state.currentIndex);
        row.addEventListener('dragstart', (event) => {
            state.dragIndex = index;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', index.toString());
            row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
        });
        row.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', (event) => {
            event.preventDefault();
            row.classList.remove('drag-over');
            movePlaylistItem(state.dragIndex, index);
        });

        const dragCell = document.createElement('td');
        dragCell.className = 'playlist-drag-cell';
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '↕';
        dragCell.append(dragHandle);

        const orderCell = document.createElement('td');
        orderCell.className = 'playlist-order-cell';
        orderCell.textContent = index + 1;

        const titleCell = document.createElement('td');
        titleCell.className = 'playlist-track-title';
        titleCell.textContent = getTrackTitle(item.track);
        titleCell.addEventListener('click', () => playIndex(index));

        const artistCell = document.createElement('td');
        artistCell.textContent = getTrackArtist(item.track, item.artist.name) || item.artist.name;

        const albumCell = document.createElement('td');
        albumCell.textContent = getTrackAlbum(item.track, item.album.name) || item.album.name;

        const removeCell = document.createElement('td');
        removeCell.className = 'playlist-remove-cell';
        removeCell.append(createMiniButton(ICONS.remove, `Remove ${item.track.name}`, () => removePlaylistItem(index), 'danger'));

        row.append(dragCell, orderCell, titleCell, artistCell, albumCell, removeCell);
        body.append(row);
    });

    table.append(header, body);
    elements.playList.append(table);

    hydratePlaylistTrackTags().catch((error) => {
        console.warn('Unable to hydrate playlist tags:', error);
    });
}

function movePlaylistItem(fromIndex, toIndex) {
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) {
        return;
    }

    const [item] = state.playlist.splice(fromIndex, 1);
    state.playlist.splice(toIndex, 0, item);

    if (state.currentIndex === fromIndex) {
        state.currentIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        state.currentIndex -= 1;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        state.currentIndex += 1;
    }

    state.dragIndex = null;
    renderPlaylist();
}

function removePlaylistItem(index) {
    if (index < 0 || index >= state.playlist.length) {
        return;
    }

    const removingCurrent = index === state.currentIndex;
    state.playlist.splice(index, 1);

    if (state.playlist.length === 0) {
        clearPlaylist();
        return;
    }

    if (index < state.currentIndex) {
        state.currentIndex -= 1;
    } else if (removingCurrent) {
        if (state.currentIndex >= state.playlist.length) {
            state.currentIndex = state.playlist.length - 1;
        }

        playIndex(state.currentIndex);
        return;
    }

    renderPlaylist();
}

function enqueueTrack(artist, album, track, options = {}) {
    state.playlist.push({ artist, album, track });
    renderPlaylist();

    if (options.playNow === true) {
        playIndex(state.playlist.length - 1);
    }
}

function enqueueTracks(artist, album, tracks, options = {}) {
    const startIndex = state.playlist.length;
    const items = tracks.map((track) => ({ artist, album, track }));

    if (options.replace === true) {
        state.playlist = items;
    } else {
        state.playlist.push(...items);
    }

    renderPlaylist();

    if (options.playNow === true) {
        playIndex(options.replace ? 0 : startIndex);
    }
}

function clearPlaylist() {
    mse.teardown();

    state.playlist = [];
    state.currentIndex = -1;
    state.preloadedIndex = -1;

    if (preloadBlobUrl) {
        URL.revokeObjectURL(preloadBlobUrl);
        preloadBlobUrl = null;
    }
    preloadBlob = null;
    preloadedDuration = null;

    if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
        activeBlobUrl = null;
    }

    elements.audioPreload.removeAttribute('src');
    elements.audioPreload.load();

    elements.audioController.pause();
    elements.audioController.removeAttribute('src');
    elements.audioController.load();
    updateAudioControls();
    updateNowPlaying(null);
    renderPlaylist();
}

function playTracks(tracks, artist, album) {
    enqueueTracks(artist, album, tracks, { replace: true, playNow: true });
}

function fetchTrackAsBlob(trackPath) {
    const url = buildUrl('track', { path: trackPath });
    return apiFetch(url)
        .then((r) => r.blob())
        .then((blob) => URL.createObjectURL(blob));
}

// ---------------------------------------------------------------------------
// Background track advance — used when moving to the next track while the
// page is hidden (screen off).
//
// MSE path (MP3): appends the preloaded blob's bytes directly into the
// existing SourceBuffer. The HTMLMediaElement never changes its src, so
// Firefox never fires abort/emptied and never starts a new background-tab
// grace-period timer. This is the key fix for the 5-second pause.
//
// Non-MSE fallback (non-MP3 or preload missing): tries a src swap without
// calling .load(). Falls back to playIndex() if that fails.
// ---------------------------------------------------------------------------
async function advanceToPreloaded(index) {
    if (index < 0 || index >= state.playlist.length) {
        return;
    }

    const item = state.playlist[index];
    const isMse = mse.active && mse.isSupported() && mse.canHandle(item.track.path_lower);

    // -----------------------------------------------------------------------
    // MSE path: bytes are eagerly appended into the SourceBuffer by
    // preloadNextTrack before the boundary is reached, so the audio element
    // plays across the boundary without any JS intervention at boundary time.
    // Here we only update UI state and — for user-triggered skips — seek to
    // the correct position in the persistent MSE timeline.
    // -----------------------------------------------------------------------
    if (isMse) {
        // Consume any pending preload state (blob bytes were already sent to
        // the SourceBuffer by the eager mse.appendNext in preloadNextTrack).
        if (preloadBlobUrl) {
            URL.revokeObjectURL(preloadBlobUrl);
            preloadBlobUrl = null;
        }
        preloadBlob = null;
        preloadedDuration = null;
        state.preloadedIndex = -1;
        elements.audioPreload.removeAttribute('src');
        elements.audioPreload.load();

        if (mse.isAppended(index)) {
            // Track is already in the SourceBuffer — seek to its start offset
            // in the MSE timeline and update UI state.
            state.currentIndex = index;
            const trackOffset = mse.trackOffsets[index] ?? 0;
            elements.audioController.currentTime = trackOffset;
            renderPlaylist();
            updateNowPlaying(item);
            registerMediaSessionHandlers();
            updateMediaSession(item.track, item.artist.name, item.album.name);
            if (elements.audioController.paused && !state.userPaused) {
                try {
                    await elements.audioController.play();
                } catch (err) {
                    console.warn(`advanceToPreloaded(${index}): MSE play() rejected \u2014 ${err?.message ?? err}`);
                }
            }
            // Kick off preload + eager append of the track after this one.
            preloadNextTrack();
            // Non-blocking tag hydration.
            try {
                const tags = await getTagsFast(item.track);
                item.track._tags = tags;
                updateNowPlaying(item);
                renderTracks();
                renderPlaylist();
                updateMediaSession(item.track, item.artist.name, item.album.name);
            } catch {
                // tag read failures are non-fatal
            }
            return;
        }

        // Track not yet appended (slow network or user skipped non-sequentially).
        // Hand off to playIndex which starts a fresh MSE session.
        console.log(`advanceToPreloaded(${index}): MSE bytes not yet appended \u2014 falling back to playIndex`);
        return playIndex(index);
    }

    if (state.preloadedIndex !== index || !preloadBlobUrl) {
        // No preloaded blob — fall back to normal playIndex().
        console.log(`advanceToPreloaded(${index}): no blob, falling back to playIndex`);
        return playIndex(index);
    }

    // -----------------------------------------------------------------------
    // Non-MSE fallback: src swap without .load()
    // -----------------------------------------------------------------------
    console.log(`advanceToPreloaded(${index}): swapping src without load()`);

    state.currentIndex = index;
    renderPlaylist();
    updateNowPlaying(item);
    registerMediaSessionHandlers();
    updateMediaSession(item.track, item.artist.name, item.album.name);

    // Swap to the preloaded blob.
    if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
    }
    activeBlobUrl = preloadBlobUrl;
    preloadBlobUrl = null;
    preloadBlob = null;
    preloadedDuration = null;
    state.preloadedIndex = -1;

    // Assign src WITHOUT calling .load() — this is the key difference.
    // Firefox treats this as a continuation of the same media session rather
    // than a brand-new one, so no background-play grace period is triggered.
    elements.audioController.src = activeBlobUrl;
    elements.audioController.currentTime = 0;

    try {
        await elements.audioController.play();
        console.log(`advanceToPreloaded(${index}): play() succeeded`);
    } catch (err) {
        console.warn(`advanceToPreloaded(${index}): play() rejected \u2014 ${err?.message ?? err}, falling back to playIndex`);
        return playIndex(index);
    }

    // Kick off the next preload immediately.
    preloadNextTrack();

    // Non-blocking tag hydration.
    try {
        const tags = await getTagsFast(item.track);
        item.track._tags = tags;
        updateNowPlaying(item);
        renderTracks();
        renderPlaylist();
        updateMediaSession(item.track, item.artist.name, item.album.name);
    } catch {
        // tag read failures are non-fatal
    }
}

async function playIndex(index) {
    if (index < 0 || index >= state.playlist.length) {
        return;
    }

    state.currentIndex = index;
    renderPlaylist();

    const item = state.playlist[index];
    updateNowPlaying(item);

    // Register media session handlers and metadata immediately so lock screen
    // controls (skip buttons) are available before tag hydration completes.
    registerMediaSessionHandlers();
    updateMediaSession(item.track, item.artist.name, item.album.name);

    try {
        // ------------------------------------------------------------------
        // MSE path — for MP3 tracks, initialise a persistent MediaSource so
        // that we never have to change audio.src at track boundaries.
        // (playIndex is only called for the FIRST track or when the user
        //  explicitly jumps to a different track. Subsequent auto-advances go
        //  through advanceToPreloaded which appends into the existing buffer.)
        // ------------------------------------------------------------------
        const mpegMseOk = mse.isSupported() && mse.canHandle(item.track.path_lower);
        console.log(
            `playIndex(${index}): MediaSource=${typeof MediaSource !== 'undefined'} isTypeSupported(${MSE_CODEC})=${typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(MSE_CODEC)} canHandle=${mse.canHandle(item.track.path_lower)} → path=${mpegMseOk ? 'MSE' : 'blob/src'}`,
        );

        if (mpegMseOk) {
            // Tear down any previous MSE session.
            mse.teardown();
            // Also revoke any plain blob URL for the previous track.
            if (activeBlobUrl) {
                URL.revokeObjectURL(activeBlobUrl);
                activeBlobUrl = null;
            }

            // Use the already-preloaded blob if it matches this index; otherwise
            // fetch a fresh blob now.
            let blob;
            let startDuration;

            if (state.preloadedIndex === index && preloadBlob) {
                blob = preloadBlob;
                startDuration = preloadedDuration;
                // Consume the preloaded blob.
                preloadBlob = null;
                preloadBlobUrl && URL.revokeObjectURL(preloadBlobUrl);
                preloadBlobUrl = null;
                preloadedDuration = null;
                state.preloadedIndex = -1;
                elements.audioPreload.removeAttribute('src');
                elements.audioPreload.load();
            } else {
                // Discard any stale preload blob.
                if (preloadBlobUrl) {
                    URL.revokeObjectURL(preloadBlobUrl);
                    preloadBlobUrl = null;
                }
                preloadBlob = null;
                preloadedDuration = null;
                state.preloadedIndex = -1;
                elements.audioPreload.removeAttribute('src');
                elements.audioPreload.load();

                const url = buildUrl('track/transcode', { path: item.track.path_lower });
                const response = await apiFetch(url);
                blob = await response.blob();
                startDuration = null; // will be derived from buffered range
            }

            console.log(`playIndex(${index}): initialising MSE for ${item.track.path_lower}`);
            await mse.init(blob, startDuration, index);

            try {
                await elements.audioController.play();
            } catch (err) {
                console.warn(`playIndex(${index}): MSE play() rejected — ${err?.message ?? err}`);
            }

            preloadNextTrack();

            // Hydrate tags (non-blocking).
            try {
                const tags = await getTagsFast(item.track);
                item.track._tags = tags;
                updateNowPlaying(item);
                renderTracks();
                renderPlaylist();
                updateMediaSession(item.track, item.artist.name, item.album.name);
            } catch (error) {
                console.warn('Tag read failed:', error);
                updateMediaSession(item.track, item.artist.name, item.album.name);
            }
            return;
        }

        // ------------------------------------------------------------------
        // Non-MSE path (FLAC, OGG, M4A, etc.) — same as before.
        // ------------------------------------------------------------------

        // Tear down any active MSE session when switching away from MP3.
        if (mse.active) {
            mse.teardown();
        }

        // Revoke the blob URL of the track we are replacing (if any).
        if (activeBlobUrl) {
            URL.revokeObjectURL(activeBlobUrl);
            activeBlobUrl = null;
        }

        const usePreloaded = state.preloadedIndex === index && preloadBlobUrl;

        if (usePreloaded) {
            activeBlobUrl = preloadBlobUrl;
            preloadBlobUrl = null;
            preloadBlob = null;
            preloadedDuration = null;
            state.preloadedIndex = -1;
            elements.audioPreload.removeAttribute('src');
            elements.audioPreload.load();
            // Assign the new src and seek to start, then let play() below
            // handle playback. We call .load() here because this is a
            // user-initiated jump (page is visible), so the grace-period
            // reset doesn't matter.
            elements.audioController.src = activeBlobUrl;
            elements.audioController.load();
            elements.audioController.currentTime = 0;
        } else {
            // Discard any stale preload blob.
            if (preloadBlobUrl) {
                URL.revokeObjectURL(preloadBlobUrl);
                preloadBlobUrl = null;
            }
            preloadBlob = null;
            preloadedDuration = null;
            state.preloadedIndex = -1;
            elements.audioPreload.removeAttribute('src');
            elements.audioPreload.load();
            const streamUrl = buildStreamUrl(item.track.path_lower);
            elements.audioController.src = streamUrl;
            elements.audioController.load();
        }

        // Call play() directly without waiting for canplay first. Awaiting
        // canplay before play() prevents background playback on Firefox for
        // Android when the screen is off: the browser throttles the page and
        // the canplay event may never fire, leaving the queue permanently
        // stalled. The browser handles buffering internally once play() is
        // invoked. If play() rejects due to a media error (not just an
        // autoplay restriction), fall back to a buffered blob fetch.
        try {
            await elements.audioController.play();
        } catch {
            if (elements.audioController.error) {
                try {
                    console.warn('Stream failed, falling back to buffered fetch:', item.track.path_lower);
                    const blobUrl = await fetchTrackAsBlob(item.track.path_lower);
                    activeBlobUrl = blobUrl;
                    elements.audioController.src = blobUrl;
                    elements.audioController.load();
                    await elements.audioController.play();
                } catch {
                    // blob fallback also failed
                }
            }
            // autoplay restrictions are acceptable
        }

        // Start preloading the next track as a full blob immediately so that
        // no network request is needed when the current track ends — critical
        // for Firefox for Android which throttles stream fetches with screen off.
        preloadNextTrack();

        // Hydrate tags via small range request (non-blocking)
        try {
            const tags = await getTagsFast(item.track);
            item.track._tags = tags;
            updateNowPlaying(item);
            renderTracks();
            renderPlaylist();
            updateMediaSession(item.track, item.artist.name, item.album.name);
        } catch (error) {
            console.warn('Tag read failed:', error);
            updateMediaSession(item.track, item.artist.name, item.album.name);
        }
    } catch (error) {
        console.error(error);
    }
}

async function preloadNextTrack() {
    let nextIndex = -1;

    if (state.repeatMode === 'one') {
        return;
    }

    if (state.currentIndex + 1 < state.playlist.length) {
        nextIndex = state.currentIndex + 1;
    } else if (state.repeatMode === 'all' && state.playlist.length > 0) {
        nextIndex = 0;
    }

    if (nextIndex < 0 || nextIndex === state.preloadedIndex) {
        return;
    }

    const nextItem = state.playlist[nextIndex];

    if (!nextItem) {
        return;
    }

    try {
        // Discard any previous preload blob before starting a new download.
        if (preloadBlobUrl) {
            URL.revokeObjectURL(preloadBlobUrl);
            preloadBlobUrl = null;
        }
        preloadBlob = null;
        preloadedDuration = null;
        state.preloadedIndex = -1;
        elements.audioPreload.removeAttribute('src');
        elements.audioPreload.load();

        // Fully buffer the next track as a blob so that when the current track
        // ends—even with the phone screen off—no new network request is needed.
        // Firefox for Android throttles stream fetches in background tabs,
        // causing 60+ second delays if we use a stream URL at transition time.
        // When MSE is active, fetch from the transcode endpoint (fMP4/Opus) so
        // the blob can be appended directly into the SourceBuffer.
        const useMse = mse.active && mse.isSupported() && mse.canHandle(nextItem.track.path_lower);
        const endpoint = useMse ? 'track/transcode' : 'track';
        console.log(`Preloading track ${nextIndex} as blob (endpoint=${endpoint})…`);
        const url = buildUrl(endpoint, { path: nextItem.track.path_lower });
        const response = await apiFetch(url);
        const blob = await response.blob();
        preloadBlob = blob;
        const blobUrl = URL.createObjectURL(blob);
        preloadBlobUrl = blobUrl;
        // For MSE tracks, we feed bytes directly to the SourceBuffer; loading
        // the blob into a second <audio> element wastes memory and creates a
        // duplicate decode buffer that contributes to the mobile quota limit.
        if (!useMse) {
            elements.audioPreload.src = blobUrl;
            elements.audioPreload.load();
        }
        state.preloadedIndex = nextIndex;
        console.log(`Preloaded track ${nextIndex} (blob ready)`);

        // MSE deferred append —————————————————————————————————————————————
        // We intentionally do NOT append into the SourceBuffer here.  On mobile
        // the SourceBuffer quota is typically ~12 MB.  A long track (e.g. 7 MB)
        // can fill the entire quota on its own, leaving no room for the next
        // track.  Appending immediately would fail with QuotaExceededError.
        //
        // Instead we wait until the current track is within 30 s of ending
        // (see the timeupdate handler below), at which point ~90 % of the
        // current track's data has been consumed and evicted, leaving plenty
        // of space.  A setInterval safety net (below) handles the case where
        // timeupdate is throttled with the screen off (Firefox for Android).
        if (useMse && mse.active) {
            // Cancel any previous retry timer for a different track.
            if (mse._appendRetryTimer !== null) {
                clearInterval(mse._appendRetryTimer);
                mse._appendRetryTimer = null;
            }

            const attemptAppend = async () => {
                // Bail if conditions have changed since the timer was set up.
                if (!mse.active || mse.isAppended(nextIndex) || state.preloadedIndex !== nextIndex) {
                    if (mse._appendRetryTimer !== null) {
                        clearInterval(mse._appendRetryTimer);
                        mse._appendRetryTimer = null;
                    }
                    return;
                }
                try {
                    await mse.appendNext(blob, null, nextIndex);
                    // Success — clear the timer.
                    if (mse._appendRetryTimer !== null) {
                        clearInterval(mse._appendRetryTimer);
                        mse._appendRetryTimer = null;
                    }
                } catch (err) {
                    const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
                    if (isQuota) {
                        // Still not enough room — keep the retry timer going.
                        console.log(`preloadNextTrack: SourceBuffer full for track ${nextIndex} \u2014 will retry (${Math.round(elements.audioController.currentTime)}s played so far)`);
                        if (mse._appendRetryTimer === null) {
                            mse._appendRetryTimer = setInterval(attemptAppend, 15000);
                        }
                    } else {
                        console.warn(`preloadNextTrack: MSE append for track ${nextIndex} failed \u2014 ${err?.message ?? err}`);
                        // Non-quota error — stop retrying.
                        if (mse._appendRetryTimer !== null) {
                            clearInterval(mse._appendRetryTimer);
                            mse._appendRetryTimer = null;
                        }
                    }
                }
            };

            // The timeupdate handler will fire this at the 30-second mark.
            // This first call is a no-op on mobile where the buffer is full,
            // but succeeds immediately on desktop (large quota) or for short
            // tracks that leave room in the buffer.
            attemptAppend();
        }

        // Warm the server-side transcode cache for the track AFTER next so
        // that when it becomes the preload target, the server responds from
        // disk cache instead of re-transcoding.  Fire-and-forget.
        if (useMse) {
            let warmIndex = -1;
            if (nextIndex + 1 < state.playlist.length) {
                warmIndex = nextIndex + 1;
            } else if (state.repeatMode === 'all' && state.playlist.length > 0) {
                warmIndex = 0;
            }
            if (warmIndex >= 0 && warmIndex !== state.currentIndex) {
                const warmItem = state.playlist[warmIndex];
                if (warmItem) {
                    const warmUrl = buildUrl('track/transcode', { path: warmItem.track.path_lower });
                    apiFetch(warmUrl).catch(() => {}); // best-effort, ignore errors
                    console.log(`Cache-warming track ${warmIndex}`);
                }
            }
        }
    } catch (err) {
        console.warn('Preload failed:', err?.message ?? err);
        // preload is best-effort
    }
}

function updateMediaSession(track, artistName, albumName) {
    if (!('mediaSession' in navigator)) {
        return;
    }

    const title = getTrackTitle(track);
    const artist = getTrackArtist(track, artistName) || 'Unknown artist';
    const album = getTrackAlbum(track, albumName) || 'Unknown album';

    navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: DEFAULT_ARTWORK_URI
            ? [
                  { src: DEFAULT_ARTWORK_URI, sizes: '96x96', type: 'image/png' },
                  { src: DEFAULT_ARTWORK_URI, sizes: '192x192', type: 'image/png' },
                  { src: DEFAULT_ARTWORK_URI, sizes: '512x512', type: 'image/png' },
              ]
            : [],
    });

    registerMediaSessionHandlers();
}

function registerMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) {
        return;
    }

    const handlers = {
        play: () => {
            state.userPaused = false;
            return elements.audioController.play();
        },
        pause: () => {
            // Only treat this as a deliberate user pause when the page is
            // visible. Firefox for Android fires the MediaSession pause action
            // as part of its own background-tab throttling (screen off), which
            // is NOT a user gesture. If we set userPaused=true in that case,
            // the visibilitychange auto-resume is incorrectly suppressed.
            if (!document.hidden) {
                state.userPaused = true;
            }
            elements.audioController.pause();
        },
        previoustrack: () => previousTrack(),
        nexttrack: () => nextTrack(),
        seekto: (details) => {
            if (details.seekTime != null) {
                if (mse.active) {
                    mse.seek(details.seekTime);
                } else if (Number.isFinite(elements.audioController.duration)) {
                    elements.audioController.currentTime = details.seekTime;
                }
                updateMediaSessionPositionState();
            }
        },
        seekbackward: (details) => {
            const cur = mse.active ? mse.currentTrackTime(elements.audioController) : elements.audioController.currentTime;
            if (mse.active) {
                mse.seek(Math.max(0, cur - (details.seekOffset || 10)));
            } else {
                elements.audioController.currentTime = Math.max(0, elements.audioController.currentTime - (details.seekOffset || 10));
            }
            updateMediaSessionPositionState();
        },
        seekforward: (details) => {
            const dur = mse.active ? mse.currentTrackDuration() : elements.audioController.duration || 0;
            const cur = mse.active ? mse.currentTrackTime(elements.audioController) : elements.audioController.currentTime;
            if (mse.active) {
                mse.seek(Math.min(dur, cur + (details.seekOffset || 10)));
            } else {
                elements.audioController.currentTime = Math.min(dur, elements.audioController.currentTime + (details.seekOffset || 10));
            }
            updateMediaSessionPositionState();
        },
    };

    Object.entries(handlers).forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch {
            // ignore unsupported actions
        }
    });
}

function updateMediaSessionPositionState() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') {
        return;
    }

    const duration = mse.active ? mse.currentTrackDuration() : elements.audioController.duration;
    const currentTime = mse.active ? mse.currentTrackTime(elements.audioController) : elements.audioController.currentTime;

    if (!Number.isFinite(duration) || duration <= 0) {
        return;
    }

    try {
        navigator.mediaSession.setPositionState({
            duration,
            playbackRate: elements.audioController.playbackRate || 1,
            position: Math.min(currentTime, duration),
        });
    } catch {
        // ignore if position state is not supported
    }
}

function nextTrack() {
    if (state.playlist.length === 0) {
        return;
    }

    // Always go through advanceToPreloaded so the MSE path (or no-load blob
    // swap) is used regardless of whether the page is visible. advanceToPreloaded
    // falls back to playIndex() when no preloaded blob is available.
    if (state.repeatMode === 'one') {
        advanceToPreloaded(state.currentIndex);
        return;
    }

    if (state.currentIndex + 1 < state.playlist.length) {
        advanceToPreloaded(state.currentIndex + 1);
        return;
    }

    if (state.repeatMode === 'all') {
        advanceToPreloaded(0);
    }
}

function previousTrack() {
    if (state.playlist.length === 0) {
        return;
    }

    if (elements.audioController.currentTime > 3) {
        elements.audioController.currentTime = 0;
        return;
    }

    if (state.currentIndex > 0) {
        playIndex(state.currentIndex - 1);
        return;
    }

    if (state.repeatMode === 'all') {
        playIndex(state.playlist.length - 1);
    }
}

async function queueAlbum(artist, album, playNow) {
    const data = await apiGetJson(collectionApiPath('tracks'), { artist: artist.name, album: album.name });
    const tracks = sortTracks(data.track_list);

    if (playNow) {
        enqueueTracks(artist, album, tracks, { replace: true, playNow: true });
    } else {
        enqueueTracks(artist, album, tracks);
    }
}

async function loadAlbums(artist) {
    const view = activeView();
    view.selectedArtist = artist;
    view.selectedAlbum = null;
    view.tracks = [];
    renderTracks();
    setExpandedSection('album-section');

    const data = await apiGetJson(collectionApiPath('album'), { artist: artist.name });
    view.albums = sortAlbums(data.album_list);
    renderAlbums();
}

async function loadTracks(artist, album) {
    const view = activeView();
    view.selectedArtist = artist;
    view.selectedAlbum = album;
    setExpandedSection('track-section');

    const data = await apiGetJson(collectionApiPath('tracks'), { artist: artist.name, album: album.name });
    view.tracks = sortTracks(data.track_list);
    renderTracks();
}

// ---------------------------------------------------------------------------
// Collection toggle (Library / Incoming) — switches the artist/album/track
// panels between two parallel collection slices. The incoming collection is
// fetched lazily on first activation; selections in each side are preserved
// across switches. The shared playlist is unaffected by the toggle.
// ---------------------------------------------------------------------------
async function setCollection(name) {
    if (name !== 'library' && name !== 'incoming') {
        return;
    }
    if (state.collection === name) {
        return;
    }

    state.collection = name;
    syncCollectionToggleUI();

    // Restore the search input to whatever this collection had typed.
    const view = activeView();
    if (elements.artistSearch) {
        elements.artistSearch.value = view.artistSearchQuery || '';
    }
    if (elements.artistSearchClear) {
        elements.artistSearchClear.classList.toggle('hidden', !(view.artistSearchQuery || '').length);
    }

    // Render whatever we already have so the UI updates immediately.
    renderArtists();
    renderAlbums();
    renderTracks();

    // Lazy-load the incoming artist list on first activation.
    if (name === 'incoming' && !state.incoming.loaded) {
        try {
            const data = await apiGetJson('incoming/artist');
            state.incoming.artists = data.artist_list || [];
            state.incoming.loaded = true;
            // Only re-render if the user is still viewing incoming.
            if (state.collection === 'incoming') {
                renderArtists();
            }
        } catch (error) {
            console.warn('Unable to load incoming artists:', error);
        }
    }
}

function syncCollectionToggleUI() {
    const isIncoming = state.collection === 'incoming';
    if (elements.collectionToggleLibrary) {
        elements.collectionToggleLibrary.classList.toggle('active', !isIncoming);
        elements.collectionToggleLibrary.setAttribute('aria-selected', String(!isIncoming));
    }
    if (elements.collectionToggleIncoming) {
        elements.collectionToggleIncoming.classList.toggle('active', isIncoming);
        elements.collectionToggleIncoming.setAttribute('aria-selected', String(isIncoming));
    }
    if (elements.artistSection) {
        elements.artistSection.classList.toggle('collection-incoming', isIncoming);
    }
}

function setupCollectionToggle() {
    syncCollectionToggleUI();
    if (elements.collectionToggleLibrary) {
        elements.collectionToggleLibrary.addEventListener('click', () => {
            setCollection('library');
        });
    }
    if (elements.collectionToggleIncoming) {
        elements.collectionToggleIncoming.addEventListener('click', () => {
            setCollection('incoming');
        });
    }
}

async function hydrateLibraryIdentity() {
    const data = await apiGetJson('api/auth/me');
    if (elements.libraryUser) {
        elements.libraryUser.textContent = `Signed in as ${data.user.user}${data.user.isAdmin ? ' (admin)' : ''}`;
    }
    state.currentUser = data.user;
}

// ---------------------------------------------------------------------------
// Presence reporting / feed — reports what the user is listening to and
// shows what others are listening to. Uses simple polling (~6s) since the
// server sits behind Apache which doesn't play nicely with SSE.
// ---------------------------------------------------------------------------
let _presenceLastKey = null;
let _presenceLastSentAt = 0;
const PRESENCE_POST_THROTTLE_MS = 2000;

function _presenceKeyFor(item) {
    if (!item) {
        return 'null';
    }
    const title = getTrackTitle(item.track);
    const artist = getTrackArtist(item.track, item.artist?.name) || item.artist?.name || '';
    const album = getTrackAlbum(item.track, item.album?.name) || item.album?.name || '';
    return `${title}\u0000${artist}\u0000${album}`;
}

function reportPresence(item) {
    const key = _presenceKeyFor(item);
    const now = Date.now();
    if (key === _presenceLastKey && now - _presenceLastSentAt < PRESENCE_POST_THROTTLE_MS) {
        return;
    }
    _presenceLastKey = key;
    _presenceLastSentAt = now;

    let body;
    if (item) {
        body = JSON.stringify({
            track: getTrackTitle(item.track),
            artist: getTrackArtist(item.track, item.artist?.name) || item.artist?.name || '',
            album: getTrackAlbum(item.track, item.album?.name) || item.album?.name || '',
        });
    } else {
        body = JSON.stringify(null);
    }

    apiFetch(buildUrl('api/nowplaying'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    })
        .then(() => {
            console.log('reportPresence: POST ok', body);
        })
        .catch((err) => {
            console.warn('reportPresence failed:', err?.message ?? err);
        });
}

function reportPresenceClear() {
    reportPresence(null);
}

const presenceFeed = {
    _timer: null,
    _open: false,
    _listeners: [],

    start() {
        if (this._timer) {
            return;
        }
        const refresh = () => {
            this._refresh().catch((err) => {
                console.warn('presenceFeed refresh failed:', err?.message ?? err);
            });
        };
        refresh();
        this._timer = setInterval(refresh, 6000);
        // Refresh promptly when the user returns to the tab.
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                refresh();
            }
        });
        if (elements.presencePill) {
            const pillButton = elements.presencePill.querySelector('.presence-pill-btn');
            if (pillButton) {
                pillButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this._open = !this._open;
                    this._render();
                });
            }
            document.addEventListener('click', (event) => {
                if (this._open && !elements.presencePill.contains(event.target)) {
                    this._open = false;
                    this._render();
                }
            });
        }
    },

    async _refresh() {
        const data = await apiGetJson('api/nowplaying');
        this._listeners = Array.isArray(data?.listeners) ? data.listeners : [];
        this._render();
    },

    _render() {
        const pill = elements.presencePill;
        if (!pill) {
            return;
        }
        const count = this._listeners.length;
        if (count === 0) {
            pill.classList.add('hidden');
            this._open = false;
            return;
        }
        pill.classList.remove('hidden');
        if (elements.presencePillCount) {
            elements.presencePillCount.textContent = String(count);
        }

        if (elements.presencePillList) {
            elements.presencePillList.innerHTML = '';
            this._listeners.forEach((listener) => {
                const li = document.createElement('li');
                li.className = 'presence-pill-item';
                const name = document.createElement('span');
                name.className = 'presence-pill-user';
                name.textContent = listener.user;
                const detail = document.createElement('span');
                detail.className = 'presence-pill-track';
                const trackText = listener.track || '—';
                const artistText = listener.artist ? ` · ${listener.artist}` : '';
                detail.textContent = `${trackText}${artistText}`;
                li.append(name, detail);
                elements.presencePillList.append(li);
            });
        }
        pill.classList.toggle('open', this._open);
    },
};

async function initializeLibrary() {
    if (elements.logoutButton) {
        elements.logoutButton.addEventListener('click', () => {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            redirectToLogin();
        });
    }

    syncStickyOffsets();
    window.addEventListener('resize', syncStickyOffsets);
    window.addEventListener('orientationchange', syncStickyOffsets);
    window.addEventListener('resize', applyNowPlayingScroll);
    requestAnimationFrame(syncStickyOffsets);

    initAccordion();

    state.artistSearchQuery = '';
    if (elements.artistSearch) {
        elements.artistSearch.value = '';
    }
    if (elements.artistSearchClear) {
        elements.artistSearchClear.classList.add('hidden');
    }

    if (elements.artistSearch) {
        elements.artistSearch.addEventListener('input', (event) => {
            activeView().artistSearchQuery = event.target.value || '';
            renderArtists();
        });

        elements.artistSearch.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                activeView().artistSearchQuery = '';
                elements.artistSearch.value = '';
                renderArtists();
            }
        });
    }

    if (elements.artistSearchClear) {
        elements.artistSearchClear.addEventListener('click', () => {
            activeView().artistSearchQuery = '';
            if (elements.artistSearch) {
                elements.artistSearch.value = '';
                elements.artistSearch.focus();
            }
            renderArtists();
        });
    }

    setupCollectionToggle();

    elements.audioController.addEventListener('ended', () => nextTrack());

    // When the page becomes visible again (screen unlocked):
    // 1. Auto-resume if Firefox paused playback externally.
    // 2. Retry preloading the next track if the background fetch failed.
    document.addEventListener('visibilitychange', () => {
        console.log(`visibilitychange: hidden=${document.hidden} paused=${elements.audioController.paused} userPaused=${state.userPaused} preloadedIndex=${state.preloadedIndex}`);

        if (!document.hidden) {
            // Resume playback if it was paused externally (not by the user).
            if (elements.audioController.paused && !state.userPaused && state.currentIndex >= 0 && !elements.audioController.ended) {
                console.log('Visibility restored — resuming after external pause');
                elements.audioController.play().catch((err) => {
                    console.warn('Auto-resume rejected:', err?.message ?? String(err));
                });
            }

            // Re-acquire the wake lock (it's automatically released when the
            // page becomes hidden, so we must request it again on restore).
            if (!elements.audioController.paused || !state.userPaused) {
                acquireWakeLock();
            }

            // Retry preload if it failed while screen was off.
            if (state.preloadedIndex < 0 && state.currentIndex >= 0) {
                console.log('Visibility restored — retrying failed preload');
                preloadNextTrack();
            }
        }
    });

    elements.audioController.addEventListener('loadedmetadata', () => {
        if (state.currentIndex >= 0) {
            updateNowPlaying(state.playlist[state.currentIndex]);
        }
    });

    // Capture the preloaded track's duration as soon as the browser parses its
    // headers. This is needed by the MSE engine to set the correct
    // timestampOffset when appending the next track's bytes seamlessly.
    elements.audioPreload.addEventListener('loadedmetadata', () => {
        preloadedDuration = elements.audioPreload.duration || null;
        console.log(`audioPreload loadedmetadata: duration=${preloadedDuration}`);
    });

    elements.audioController.addEventListener('timeupdate', () => {
        const rawTime = elements.audioController.currentTime;
        const rawDuration = elements.audioController.duration;

        // Fallback: trigger preload if not already in progress (e.g. if the
        // immediate preload after play() was skipped due to an error).
        if (Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration - rawTime < 60 && state.preloadedIndex < 0) {
            preloadNextTrack();
        }

        // MSE track-boundary detection.
        // When MSE is active the <audio> element plays a single long timeline.
        // There is no native 'ended' event at individual track boundaries, so
        // we watch currentTime.  When the playhead reaches (or passes) the end
        // of the current track's data we advance to the next track.
        if (mse.active) {
            const curIdx = state.currentIndex;
            const curOffset = mse.trackOffsets[curIdx] ?? 0;
            const curDuration = mse.trackDurations[curIdx] ?? 0;
            const curEnd = curOffset + curDuration;

            // Deferred MSE append ————————————————————————————————————————
            // When the current track has < 30 s left and the next track's blob
            // is ready but not yet in the SourceBuffer, append it now.  At
            // this point the current track's data is mostly consumed, so the
            // SourceBuffer has enough free quota to accept the next track.
            // This is the primary trigger; the setInterval in preloadNextTrack
            // is the safety net for when timeupdate is throttled with screen off.
            if (curDuration > 0 && state.preloadedIndex >= 0 && preloadBlob !== null && !mse.isAppended(state.preloadedIndex) && mse._pendingAppend !== state.preloadedIndex) {
                const timeLeft = curEnd - rawTime;
                if (timeLeft > 0 && timeLeft <= 30) {
                    const idxToAppend = state.preloadedIndex;
                    const blobToAppend = preloadBlob;
                    console.log(`timeupdate: deferred MSE append for track ${idxToAppend} (${timeLeft.toFixed(1)} s left)`);
                    mse.appendNext(blobToAppend, null, idxToAppend).catch((err) => {
                        console.warn(`timeupdate: deferred MSE append failed \u2014 ${err?.message ?? err}`);
                    });
                }
            }

            // Use a small tolerance (0.15 s) because timeupdate fires at ~250 ms
            // intervals and the playhead may not land exactly on the boundary.
            if (curDuration > 0 && rawTime >= curEnd - 0.15) {
                const nextIdx = curIdx + 1;
                if (nextIdx < state.playlist.length) {
                    // The next track's bytes were already appended eagerly by
                    // preloadNextTrack, so audio is already playing through the
                    // boundary without any JS intervention. We only need to
                    // update the UI to reflect the new current track.
                    console.log(`timeupdate: MSE boundary \u2014 rawTime=${rawTime.toFixed(2)} curEnd=${curEnd.toFixed(2)}, updating UI to track ${nextIdx}`);
                    state.currentIndex = nextIdx;
                    const nextItem = state.playlist[nextIdx];
                    renderPlaylist();
                    updateNowPlaying(nextItem);
                    registerMediaSessionHandlers();
                    updateMediaSession(nextItem.track, nextItem.artist.name, nextItem.album.name);
                    // Release consumed preload state and start preloading the
                    // track after next (and its eager MSE append).
                    if (preloadBlobUrl) {
                        URL.revokeObjectURL(preloadBlobUrl);
                        preloadBlobUrl = null;
                    }
                    preloadBlob = null;
                    preloadedDuration = null;
                    state.preloadedIndex = -1;
                    elements.audioPreload.removeAttribute('src');
                    elements.audioPreload.load();
                    preloadNextTrack();
                    // Non-blocking tag hydration for the new current track.
                    const hydrateItem = nextItem;
                    const hydrateIdx = nextIdx;
                    getTagsFast(hydrateItem.track)
                        .then((tags) => {
                            hydrateItem.track._tags = tags;
                            if (state.currentIndex === hydrateIdx) {
                                updateNowPlaying(hydrateItem);
                                updateMediaSession(hydrateItem.track, hydrateItem.artist.name, hydrateItem.album.name);
                                renderPlaylist();
                            }
                        })
                        .catch(() => {});
                } else if (state.repeatMode === 'all' && state.playlist.length > 0) {
                    // For repeat-all, the MSE timeline does not wrap — tear down
                    // and restart from track 0 via nextTrack() → playIndex().
                    console.log(`timeupdate: MSE boundary (repeat-all) \u2014 rawTime=${rawTime.toFixed(2)} curEnd=${curEnd.toFixed(2)}, restarting from track 0`);
                    nextTrack();
                }
                // else: last track, no repeat — let it sit; the 'ended' event
                // on the MediaSource will handle it when endOfStream is called.
            }
        }
    });

    createPlaylistControls();
    initializeCustomAudioControls();
    renderAlbums();
    renderTracks();
    renderPlaylist();
    await hydrateLibraryIdentity();

    presenceFeed.start();
    window.addEventListener('beforeunload', reportPresenceClear);
    window.addEventListener('pagehide', reportPresenceClear);

    const data = await apiGetJson('artist');
    state.artists = data.artist_list;
    renderArtists();
}

// ---------------------------------------------------------------------------
// Debug panel — toggled by the "DBG" button in the topbar.
// Shows live audio/MediaSession state and captures console output + audio
// events so the app can be debugged on mobile without USB remote debugging.
// ---------------------------------------------------------------------------
function initDebugPanel() {
    const panel = document.getElementById('debug-panel');
    const statusEl = document.getElementById('debug-status');
    const logEl = document.getElementById('debug-log');
    const toggleBtn = document.getElementById('debug-toggle');
    const closeBtn = document.getElementById('debug-close-btn');
    const clearBtn = document.getElementById('debug-clear-btn');

    if (!panel || !statusEl || !logEl || !toggleBtn) {
        return;
    }

    const MAX_ENTRIES = 60;
    const entries = [];
    let statusTimer = null;

    const LEVEL_STYLE = {
        log: 'color:#c8ffc8',
        warn: 'color:#fde68a',
        error: 'color:#fca5a5',
        event: 'color:#93c5fd',
        info: 'color:#c8ffc8',
    };

    function ts() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    }

    function addEntry(level, text) {
        if (entries.length >= MAX_ENTRIES) {
            entries.shift();
        }
        entries.push({ level, text, time: ts() });
        if (panel.style.display !== 'none') {
            renderLog();
        }
    }

    function renderLog() {
        logEl.innerHTML = entries
            .map((e) => `<div style="${LEVEL_STYLE[e.level] || LEVEL_STYLE.log}"><span style="color:#555">${e.time}</span> <span style="color:#888">[${e.level}]</span> ${escapeHtml(e.text)}</div>`)
            .join('');
        logEl.scrollTop = logEl.scrollHeight;
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function argsToString(args) {
        return args
            .map((a) => {
                if (a instanceof Error) return `${a.name}: ${a.message}`;
                if (typeof a === 'object' && a !== null) {
                    try {
                        return JSON.stringify(a);
                    } catch {
                        return String(a);
                    }
                }
                return String(a ?? '');
            })
            .join(' ');
    }

    // Intercept console output
    ['log', 'warn', 'error', 'info'].forEach((method) => {
        const original = console[method].bind(console);
        console[method] = (...args) => {
            original(...args);
            addEntry(method === 'info' ? 'log' : method, argsToString(args));
        };
    });

    // Capture all notable audio element events
    const audioEvents = [
        'play',
        'playing',
        'pause',
        'ended',
        'seeking',
        'seeked',
        'waiting',
        'stalled',
        'suspend',
        'canplay',
        'canplaythrough',
        'loadedmetadata',
        'loadeddata',
        'emptied',
        'error',
        'abort',
    ];

    audioEvents.forEach((evName) => {
        elements.audioController.addEventListener(evName, () => {
            const audio = elements.audioController;
            let extra = '';
            if (evName === 'error' && audio.error) {
                extra = ` code=${audio.error.code} "${audio.error.message}"`;
            }
            addEntry('event', `audio:${evName}${extra} t=${audio.currentTime.toFixed(1)}/${Number.isFinite(audio.duration) ? audio.duration.toFixed(1) : '?'} rs=${audio.readyState}`);
        });
    });

    function getStatus() {
        const audio = elements.audioController;
        const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;

        const audioLines = [
            `src:       ${audio.src ? audio.src.slice(-60) : '(none)'}`,
            `state:     ${audio.paused ? 'paused' : 'playing'}  readyState=${audio.readyState}  networkState=${audio.networkState}`,
            `time:      ${audio.currentTime.toFixed(2)} / ${Number.isFinite(audio.duration) ? audio.duration.toFixed(2) : '?'}`,
            `error:     ${audio.error ? `code=${audio.error.code} ${audio.error.message}` : 'none'}`,
        ];

        const msLines = ms ? [`ms.state:  ${ms.playbackState}`, `ms.title:  ${ms.metadata?.title ?? '—'}`, `ms.artist: ${ms.metadata?.artist ?? '—'}`] : ['mediaSession: not supported'];

        const mseSupported = typeof MediaSource !== 'undefined';
        const codecs = ['audio/mpeg', 'audio/webm; codecs="opus"', 'audio/webm; codecs="vorbis"', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="opus"'];
        const codecResults = mseSupported ? codecs.map((c) => `${c.padEnd(32)} ${MediaSource.isTypeSupported(c) ? 'YES' : 'no'}`).join('\n           ') : 'MediaSource not available';
        const currentPath = mse.active ? 'MSE' : 'blob/src';
        const mseLines = [`mse.path:  ${currentPath}  active=${mse.active}  appended=${mse.appendedUpTo}`, `mse.codec: ${codecResults}`];

        const playlistLine = `playlist:  ${state.currentIndex + 1} / ${state.playlist.length}  repeat=${state.repeatMode}`;

        return [...audioLines, ...msLines, ...mseLines, playlistLine].join('\n');
    }

    function openPanel() {
        panel.style.display = 'flex';
        renderLog();
        statusEl.textContent = getStatus();
        statusTimer = setInterval(() => {
            statusEl.textContent = getStatus();
        }, 500);
    }

    function closePanel() {
        panel.style.display = 'none';
        clearInterval(statusTimer);
        statusTimer = null;
    }

    toggleBtn.addEventListener('click', () => {
        if (panel.style.display === 'none') {
            openPanel();
        } else {
            closePanel();
        }
    });

    closeBtn.addEventListener('click', closePanel);

    clearBtn.addEventListener('click', () => {
        entries.length = 0;
        renderLog();
    });

    addEntry('log', 'Debug panel ready. Tap DBG to open/close.');

    // Log MSE codec support once so it appears in the debug log.
    if (typeof MediaSource !== 'undefined') {
        const probes = ['audio/mpeg', 'audio/webm; codecs="opus"', 'audio/webm; codecs="vorbis"', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="opus"'];
        const results = probes.map((c) => `${c}=${MediaSource.isTypeSupported(c)}`).join('  ');
        addEntry('log', `MSE codecs: ${results}`);
    } else {
        addEntry('log', 'MediaSource API not available');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initDebugPanel();
    initializeLibrary().catch((error) => {
        console.error(error);
        setEmptyState(elements.artistList, error.message || 'Unable to load library.');
    });
});
