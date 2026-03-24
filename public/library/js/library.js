const configuredApiBasePath = window.DropsonicRuntime?.apiBasePath;
const apiBasePath = typeof configuredApiBasePath === 'string' && configuredApiBasePath.trim() !== '' ? configuredApiBasePath : '../data';
const baseURL = new URL(`${apiBasePath.replace(/\/+$/u, '')}/`, window.location.href).toString();
const AUTH_TOKEN_KEY = 'dropsonic.authToken';
const nonMusicFileTypes = ['v1', 'txt', 'rar', 'm3u'];
const imageFileTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const fileTypesToExclude = [...nonMusicFileTypes, ...imageFileTypes];
const repeatModes = ['off', 'all', 'one'];

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
};

const state = {
    artists: [],
    albums: [],
    tracks: [],
    artistSearchQuery: '',
    selectedArtist: null,
    selectedAlbum: null,
    playlist: [],
    currentIndex: -1,
    repeatMode: 'off',
    dragIndex: null,
    playlistTagHydrationInFlight: false,
    preloadedIndex: -1,
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
    const currentTime = elements.audioController.currentTime;
    const duration = elements.audioController.duration;
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
                try {
                    await elements.audioController.play();
                } catch {
                    // autoplay restrictions may block play
                }
            } else {
                elements.audioController.pause();
            }
            updateAudioControls();
        });
    }

    if (elements.miniPlayToggle) {
        elements.miniPlayToggle.addEventListener('click', async () => {
            if (elements.audioController.paused) {
                try {
                    await elements.audioController.play();
                } catch {
                    // autoplay restrictions may block play
                }
            } else {
                elements.audioController.pause();
            }
            updateAudioControls();
        });
    }

    if (elements.audioSeek) {
        elements.audioSeek.addEventListener('input', (event) => {
            const duration = elements.audioController.duration;
            if (!Number.isFinite(duration) || duration <= 0) {
                return;
            }

            const ratio = Number(event.target.value) / 100;
            elements.audioController.currentTime = Math.max(0, Math.min(duration, duration * ratio));
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
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });
    elements.audioController.addEventListener('pause', () => {
        updateAudioControls();
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

function updateNowPlaying(item = null) {
    if (!item) {
        elements.nowPlayingTitle.textContent = '—';
        elements.nowPlayingSub.textContent = '—';
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

    elements.nowPlayingTitle.textContent = title;
    elements.nowPlayingSub.textContent = [contextText, detailText].filter(Boolean).join(' • ') || artist || album || detailText || 'Tag details pending…';

    requestAnimationFrame(() => {
        const el = elements.nowPlayingTitle;
        const overflow = el.scrollWidth - el.clientWidth;
        if (overflow > 0) {
            el.style.setProperty('--scroll-dist', `-${overflow}px`);
            el.classList.add('scrolling');
        } else {
            el.classList.remove('scrolling');
        }
    });

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
                Range: 'bytes=0-65535',
            },
        });

        const blob = await response.blob();
        const tags = await readTagsFromBlob(blob);

        return {
            ...tags,
            trackNo: parseTrackNumber(tags.track),
        };
    })();

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

    const artists = sortArtists(state.artists);
    const searchQuery = String(state.artistSearchQuery || '')
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

    if (!state.selectedArtist) {
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

    elements.artistSummary.textContent = `Artist: ${state.selectedArtist.name}`;
    table.className = 'table table-hover';

    state.albums.forEach((album) => {
        const row = document.createElement('tr');
        row.className = 'album-row';
        row.addEventListener('click', () => loadTracks(state.selectedArtist, album));

        const playCell = document.createElement('td');
        playCell.className = 'action-cell';
        playCell.append(createMiniButton(ICONS.play, `Play ${album.name}`, () => queueAlbum(state.selectedArtist, album, true)));

        const addCell = document.createElement('td');
        addCell.className = 'action-cell';
        addCell.append(createMiniButton(ICONS.plus, `Add ${album.name}`, () => queueAlbum(state.selectedArtist, album, false)));

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

    if (state.albums.length === 0) {
        setEmptyState(elements.albumList, 'No albums found for this artist.');
        return;
    }

    table.append(header, body);
    elements.albumList.append(table);
}

function renderTracks() {
    clearElement(elements.trackList);

    if (!state.selectedAlbum) {
        elements.albumTitle.textContent = 'Album: Select an album';
        setEmptyState(elements.trackList, 'Tracks will appear here.');
        return;
    }

    elements.albumTitle.textContent = `Album: ${state.selectedAlbum.name}`;

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

    state.tracks.forEach((track, index) => {
        const row = document.createElement('tr');
        row.className = 'track-row';

        const numberCell = document.createElement('td');
        numberCell.className = 'track-number-cell';
        numberCell.textContent = getTrackNumber(track) ?? index + 1;

        const playCell = document.createElement('td');
        playCell.className = 'action-cell';
        playCell.append(createMiniButton(ICONS.play, `Play ${track.name}`, () => playTracks([track], state.selectedArtist, state.selectedAlbum)));

        const addCell = document.createElement('td');
        addCell.className = 'action-cell';
        addCell.append(createMiniButton(ICONS.plus, `Add ${track.name}`, () => enqueueTrack(state.selectedArtist, state.selectedAlbum, track)));

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

    mapLimit(state.tracks, 4, async (track) => {
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
    state.playlist = [];
    state.currentIndex = -1;
    state.preloadedIndex = -1;

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
        const usePreloaded = state.preloadedIndex === index && elements.audioPreload.src && elements.audioPreload.readyState >= 2;

        if (usePreloaded) {
            const previousUrl = elements.audioController.src;
            elements.audioController.src = elements.audioPreload.src;
            elements.audioController.currentTime = 0;
            elements.audioPreload.removeAttribute('src');
            elements.audioPreload.load();
            state.preloadedIndex = -1;
        } else {
            const streamUrl = buildStreamUrl(item.track.path_lower);
            elements.audioController.src = streamUrl;
            elements.audioController.load();
            state.preloadedIndex = -1;
            elements.audioPreload.removeAttribute('src');
            elements.audioPreload.load();

            // If the stream fails to load, fall back to buffered fetch
            await new Promise((resolve, reject) => {
                const onCanPlay = () => {
                    cleanup();
                    resolve();
                };
                const onError = () => {
                    cleanup();
                    reject(new Error('stream failed'));
                };
                const cleanup = () => {
                    elements.audioController.removeEventListener('canplay', onCanPlay);
                    elements.audioController.removeEventListener('error', onError);
                };
                elements.audioController.addEventListener('canplay', onCanPlay, { once: true });
                elements.audioController.addEventListener('error', onError, { once: true });
            }).catch(async () => {
                console.warn('Stream failed, falling back to buffered fetch:', item.track.path_lower);
                const blobUrl = await fetchTrackAsBlob(item.track.path_lower);
                elements.audioController.src = blobUrl;
                elements.audioController.load();
            });
        }

        try {
            await elements.audioController.play();
        } catch {
            // browser autoplay restrictions are acceptable here
        }

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

function preloadNextTrack() {
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
        const streamUrl = buildStreamUrl(nextItem.track.path_lower);
        elements.audioPreload.src = streamUrl;
        elements.audioPreload.load();
        state.preloadedIndex = nextIndex;
    } catch {
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
    });

    registerMediaSessionHandlers();
}

function registerMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) {
        return;
    }

    const handlers = {
        play: () => elements.audioController.play(),
        pause: () => elements.audioController.pause(),
        previoustrack: () => previousTrack(),
        nexttrack: () => nextTrack(),
        seekto: (details) => {
            if (details.seekTime != null && Number.isFinite(elements.audioController.duration)) {
                elements.audioController.currentTime = details.seekTime;
                updateMediaSessionPositionState();
            }
        },
        seekbackward: (details) => {
            elements.audioController.currentTime = Math.max(0, elements.audioController.currentTime - (details.seekOffset || 10));
            updateMediaSessionPositionState();
        },
        seekforward: (details) => {
            elements.audioController.currentTime = Math.min(elements.audioController.duration || 0, elements.audioController.currentTime + (details.seekOffset || 10));
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

    const duration = elements.audioController.duration;
    const currentTime = elements.audioController.currentTime;

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

    if (state.repeatMode === 'one') {
        playIndex(state.currentIndex);
        return;
    }

    if (state.currentIndex + 1 < state.playlist.length) {
        playIndex(state.currentIndex + 1);
        return;
    }

    if (state.repeatMode === 'all') {
        playIndex(0);
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
    const data = await apiGetJson('tracks', { artist: artist.name, album: album.name });
    const tracks = sortTracks(data.track_list);

    if (playNow) {
        enqueueTracks(artist, album, tracks, { replace: true, playNow: true });
    } else {
        enqueueTracks(artist, album, tracks);
    }
}

async function loadAlbums(artist) {
    state.selectedArtist = artist;
    state.selectedAlbum = null;
    state.tracks = [];
    renderTracks();
    setExpandedSection('album-section');

    const data = await apiGetJson('album', { artist: artist.name });
    state.albums = sortAlbums(data.album_list);
    renderAlbums();
}

async function loadTracks(artist, album) {
    state.selectedArtist = artist;
    state.selectedAlbum = album;
    setExpandedSection('track-section');

    const data = await apiGetJson('tracks', { artist: artist.name, album: album.name });
    state.tracks = sortTracks(data.track_list);
    renderTracks();
}

async function hydrateLibraryIdentity() {
    const data = await apiGetJson('api/auth/me');
    if (elements.libraryUser) {
        elements.libraryUser.textContent = `Signed in as ${data.user.user}${data.user.isAdmin ? ' (admin)' : ''}`;
    }
}

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
            state.artistSearchQuery = event.target.value || '';
            renderArtists();
        });

        elements.artistSearch.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                state.artistSearchQuery = '';
                elements.artistSearch.value = '';
                renderArtists();
            }
        });
    }

    if (elements.artistSearchClear) {
        elements.artistSearchClear.addEventListener('click', () => {
            state.artistSearchQuery = '';
            if (elements.artistSearch) {
                elements.artistSearch.value = '';
                elements.artistSearch.focus();
            }
            renderArtists();
        });
    }

    elements.audioController.addEventListener('ended', () => nextTrack());
    elements.audioController.addEventListener('loadedmetadata', () => {
        if (state.currentIndex >= 0) {
            updateNowPlaying(state.playlist[state.currentIndex]);
        }
    });
    elements.audioController.addEventListener('timeupdate', () => {
        const duration = elements.audioController.duration;
        const currentTime = elements.audioController.currentTime;

        if (Number.isFinite(duration) && duration > 0 && duration - currentTime < 30) {
            preloadNextTrack();
        }
    });

    createPlaylistControls();
    initializeCustomAudioControls();
    renderAlbums();
    renderTracks();
    renderPlaylist();
    await hydrateLibraryIdentity();

    const data = await apiGetJson('artist');
    state.artists = data.artist_list;
    renderArtists();
}

window.addEventListener('DOMContentLoaded', () => {
    initializeLibrary().catch((error) => {
        console.error(error);
        setEmptyState(elements.artistList, error.message || 'Unable to load library.');
    });
});
