const baseURL = window.location.origin;
const AUTH_TOKEN_KEY = 'dropsonic.authToken';

function redirectToLogin() {
    window.location.replace('/login/');
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

    return response;
}

async function hydrateLibraryIdentity() {
    try {
        const response = await apiFetch(baseURL + '/api/auth/me');
        const data = await response.json();
        const label = document.getElementById('library-user');

        if (label) {
            label.textContent = `Signed in as ${data.user.user}${data.user.isAdmin ? ' (admin)' : ''}`;
        }
    } catch (error) {
        console.error(error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('library-logout');

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            redirectToLogin();
        });
    }

    hydrateLibraryIdentity();
});
const mediaPicker = document.getElementById('media-picker');
const artistList = document.getElementById('artist-list');
const albumList = document.getElementById('album-list');
const trackList = document.getElementById('track-list');
const mediaPlayer = document.getElementById('media-player');
const playList = document.getElementById('playlist');
const playlistControls = document.getElementById('playlist-controls');
const audioController = document.getElementById('audio-controller');
const artistListControl = new ArtistListControl(artistList);
const albumListControl = new AlbumListControl(albumList);
const trackListControl = new TrackListControl(trackList);
const playlistControl = new PlaylistControl(playList, playlistControls);
const nonMusicFileTypes = ['v1', 'txt', 'rar', 'm3u'];
const imageFileTypes = ['jpg', 'jpeg', 'png'];
const fileTypesToExclude = [...nonMusicFileTypes, ...imageFileTypes];

function ArtistListControl(attachPoint) {
    const self = this;

    this.populate = function (artists) {
        const artistsSorted = artists
            .filter((artist) => {
                return artist['.tag'] === 'folder';
            })
            .sort((a, b) => {
                // trim leading "the" for comparison purposes
                let nameA = a.name.toUpperCase().replace(/^THE /g, ''); // ignore upper and lowercase
                let nameB = b.name.toUpperCase().replace(/^THE /g, ''); // ignore upper and lowercase

                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }

                // names must be equal
                return 0;
            });

        const artistCount = document.getElementById('artist-count');
        const artistList = document.getElementById('artist-list');
        const assortedArtists = document.createDocumentFragment();
        const artistNavigation = document.querySelectorAll('.artist-navigation');

        const artistTable = document.createElement('table');
        const artistListing = document.createElement('tbody');
        const letterShortcuts = [];
        const alphaShortcuts = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '@', '!', '+', '('];

        artistTable.className = 'table';
        artistCount.innerHTML = `Artists (${artistsSorted.length})`;

        const assortedShortcutRow = document.createElement('tr');
        const assortedShortcutItem = document.createElement('td');
        const assortedLetterLink = document.createElement('div');

        assortedLetterLink.className = 'letter-link';
        assortedLetterLink.innerHTML = '@';
        artistNavigation[0].append(assortedLetterLink);

        assortedShortcutRow.id = `shortcut-assorted`;
        assortedShortcutRow.className = 'artist-list-shortcut';
        assortedShortcutItem.innerHTML = 'Assorted!';
        assortedShortcutRow.append(assortedShortcutItem);
        assortedLetterLink.addEventListener('click', () => {
            assortedShortcutRow.scrollIntoView({ behavior: 'smooth' });
        });

        artistsSorted.forEach((artist) => {
            const artistRow = document.createElement('tr');
            const artistItem = document.createElement('td');
            // trim leading "the" to make shortcut grouping work correctly for sorted values
            const artistFirstLetter = artist.name.toUpperCase().replace(/^THE /g, '').slice(0, 1);

            if (!letterShortcuts.includes(artistFirstLetter)) {
                if (!alphaShortcuts.includes(artistFirstLetter)) {
                    const shortcutRow = document.createElement('tr');
                    const shortcutItem = document.createElement('td');
                    const letterLink = document.createElement('div');

                    letterLink.className = 'letter-link';
                    letterLink.innerHTML = artistFirstLetter;
                    letterLink.href = `#shortcut-${artistFirstLetter}`;

                    letterShortcuts.push(artistFirstLetter);

                    if (letterShortcuts.length > 13) {
                        artistNavigation[1].append(letterLink);
                    } else {
                        artistNavigation[0].append(letterLink);
                    }

                    shortcutRow.id = `shortcut-${artistFirstLetter}`;
                    shortcutRow.className = 'artist-list-shortcut';
                    letterLink.addEventListener('click', () => {
                        shortcutRow.scrollIntoView({ behavior: 'smooth' });
                    });

                    shortcutItem.innerHTML = artistFirstLetter;
                    shortcutRow.append(shortcutItem);
                    artistListing.append(shortcutRow);
                }
            }

            artistRow.className = 'artist-row';
            artistRow.addEventListener('click', (event) => {
                apiFetch(baseURL + '/album', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        artist: artist.name,
                    },
                })
                    .then((response) => response.json())
                    .then((data) => {
                        albumListControl.populate(artist, data.album_list);
                        trackListControl.clear();
                    });
            });
            artistItem.innerHTML = artist.name;
            artistRow.append(artistItem);

            if (!alphaShortcuts.includes(artistFirstLetter)) {
                artistListing.append(artistRow);
            } else {
                assortedArtists.append(artistRow);
            }
        });

        artistListing.prepend(assortedShortcutRow, assortedArtists);

        self.clear();
        artistTable.append(artistListing);
        artistList.append(artistTable);
    };
    this.clear = function () {
        const artistList = document.getElementById('artist-list');
        while (artistList.firstChild) {
            artistList.removeChild(artistList.firstChild);
        }
    };

    apiFetch(baseURL + '/artist')
        .then((response) => response.json())
        .then((data) => self.populate(data.artist_list));
}
function AlbumListControl(attachPoint) {
    const self = this;

    this.populate = function (artist, albums) {
        const artistSummary = document.getElementById('artist-summary');
        const albumList = document.getElementById('album-list');
        const albumTable = document.createElement('table');
        const albumListing = document.createElement('tbody');

        albumTable.className = 'table';
        artistSummary.innerHTML = `${artist.name}`;
        albums.forEach((album) => {
            const albumRow = document.createElement('tr');
            const albumItem = document.createElement('td');
            // omit hidden files and excluded files from album list
            let fileType = album.name.split('.').pop();

            if (album.name[0] === '.') {
                console.log('hidden file: ' + album.name);
            } else if (fileTypesToExclude.includes(fileType.toLowerCase())) {
                console.log('excluded file type: ' + album.name);
            } else {
                albumRow.className = 'album-row';
                albumItem.innerHTML = album.name;
                albumRow.addEventListener('click', (event) => {
                    apiFetch(baseURL + '/tracks', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'text/plain;charset=UTF-8',
                            artist: artist.name,
                            album: album.name,
                        },
                    })
                        .then((response) => response.json())
                        .then((data) => {
                            trackListControl.populate(artist, album, data.track_list);
                        });
                });

                albumRow.append(albumItem);
                albumListing.append(albumRow);
            }
        });

        self.clear();
        albumTable.append(albumListing);
        albumList.append(albumTable);
    };
    this.clear = function () {
        const albumList = document.getElementById('album-list');
        while (albumList.firstChild) {
            albumList.removeChild(albumList.firstChild);
        }
    };
}
function TrackListControl(attachPoint) {
    const self = this;

    // Cache tags per track path so we don't refetch on re-open
    const tagCache = new Map();

    function fileNameFallback(track) {
        return track?.name?.split('.').slice(0, -1).join(' ') || track?.name || 'Unknown track';
    }

    function parseTrackNo(v) {
        if (!v) return null;
        const m = String(v).match(/^(\d+)/); // "3/12" -> 3
        return m ? parseInt(m[1], 10) : null;
    }

    function toDisplayTitle(track, tags) {
        const title = (tags?.title || '').trim() || fileNameFallback(track);
        const artist = (tags?.artist || '').trim();
        // Choose your preferred display:
        // return artist ? `${artist} — ${title}` : title;
        return title;
    }

    function readTagsFromBlob(blob) {
        return new Promise((resolve, reject) => {
            jsmediatags.read(blob, {
                onSuccess: (tag) => resolve(tag?.tags || {}),
                onError: (err) => reject(err),
            });
        });
    }

    async function getTagsFast(track) {
        const key = track.path_lower || track.name;
        if (tagCache.has(key)) return tagCache.get(key);

        // store the in-flight promise to dedupe concurrent calls
        const p = (async () => {
            // Fetch only the first 64KB (typically enough for ID3v2)
            const resp = await apiFetch(baseURL + '/track', {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    path: track.path_lower,
                    Range: 'bytes=0-65535',
                },
            });

            if (!resp.ok && resp.status !== 206) {
                throw new Error(`Partial track fetch failed: ${resp.status}`);
            }

            const blob = await resp.blob();
            const tags = await readTagsFromBlob(blob);

            // Normalize a few helpful fields
            return {
                ...tags,
                trackNo: parseTrackNo(tags.track),
            };
        })();

        tagCache.set(key, p);
        return p;
    }

    // Simple concurrency limiter (avoids hammering your API)
    async function mapLimit(items, limit, fn) {
        const executing = new Set();
        const results = [];

        for (const item of items) {
            const p = Promise.resolve().then(() => fn(item));
            results.push(p);
            executing.add(p);
            p.finally(() => executing.delete(p));

            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }

        return Promise.allSettled(results);
    }

    this.populate = function (artist, album, tracks) {
        // omit hidden files and excluded files from track list
        const filteredTracks = tracks.filter((track) => {
            const fileType = track.name.split('.').pop();
            return track.name[0] !== '.' && !fileTypesToExclude.includes(fileType.toLowerCase());
        });

        const albumTitle = document.getElementById('album-title');
        const albumPlay = document.getElementById('album-play');
        const albumAdd = document.getElementById('album-add');
        const trackList = document.getElementById('track-list');

        const newTrackList = document.createElement('table');
        const trackHeader = document.createElement('thead');
        const trackHeaderRow = document.createElement('tr');
        const titleHeader = document.createElement('th');
        const playHeader = document.createElement('th');
        const addHeader = document.createElement('th');
        const trackListing = document.createElement('tbody');

        self.clear();

        albumTitle.innerHTML = `${album.name}`;
        albumTitle.className = 'title-text';
        playHeader.innerHTML = 'play';
        addHeader.innerHTML = 'add';
        titleHeader.innerHTML = 'Title';

        trackHeaderRow.append(playHeader, addHeader, titleHeader);
        trackHeader.append(trackHeaderRow);
        newTrackList.append(trackHeader, trackListing);

        albumPlay.classList.remove('hidden');
        albumAdd.classList.remove('hidden');

        albumPlay.onclick = () => {
            playlistControl.addTracks(artist, album, filteredTracks);
        };

        albumAdd.onclick = () => {
            playlistControl.addTracks(artist, album, filteredTracks, false);
        };

        newTrackList.className = 'table';

        // Build rows immediately with fallback title, store references for later updates
        const rowByPath = new Map();

        filteredTracks.forEach((track) => {
            const listRow = document.createElement('tr');
            const playItem = document.createElement('td');
            const addItem = document.createElement('td');
            const listItem = document.createElement('td');

            listRow.className = 'track-row';
            playItem.innerHTML = 'play';
            addItem.innerHTML = 'add';
            listItem.textContent = fileNameFallback(track); // fallback while tags load

            playItem.addEventListener('click', () => {
                playlistControl.clearPlaylist();
                playlistControl.addTrack(artist, album, track, 0);
            });

            addItem.addEventListener('click', () => {
                playlistControl.addTrack(artist, album, track);
            });

            listRow.append(playItem, addItem, listItem);
            trackListing.append(listRow);

            rowByPath.set(track.path_lower || track.name, { listRow, listItem, track });
        });

        trackList.append(newTrackList);

        // Enrich titles with ID3 tags (fast ranged requests + concurrency limit)
        // NOTE: If the user switches albums quickly, DOM might be cleared; we check isConnected.
        mapLimit(filteredTracks, 4, async (track) => {
            const key = track.path_lower || track.name;
            const refs = rowByPath.get(key);
            if (!refs) return;

            try {
                const tags = await getTagsFast(track);

                // If the list has been cleared/replaced, don't update
                if (!refs.listItem.isConnected) return;

                // Store tags for reuse elsewhere (e.g. play(), sorting, now-playing)
                track._tags = tags;

                refs.listItem.textContent = toDisplayTitle(track, tags);
            } catch (err) {
                // Keep fallback
                console.warn('Tag read failed (range):', track?.name, err);
            }
        });
    };

    this.clear = function () {
        const albumTitle = document.getElementById('album-title');
        const albumPlay = document.getElementById('album-play');
        const albumAdd = document.getElementById('album-add');
        const trackList = document.getElementById('track-list');

        albumTitle.innerHTML = '';
        albumPlay.classList.add('hidden');
        albumAdd.classList.add('hidden');

        while (trackList.firstChild) {
            trackList.removeChild(trackList.firstChild);
        }
    };
}


//         albumTitle.innerHTML = `${album.name}`;
//         albumTitle.className = 'title-text';
//         playHeader.innerHTML = 'play';
//         addHeader.innerHTML = 'add';
//         titleHeader.innerHTML = 'Title';

//         trackHeaderRow.append(playHeader, addHeader, titleHeader);
//         trackHeader.append(trackHeaderRow);
//         newTrackList.append(trackHeader, trackListing);

//         albumPlay.classList.remove('hidden');
//         albumAdd.classList.remove('hidden');

//         albumPlay.onclick = () => {
//             playlistControl.addTracks(artist, album, filteredTracks);
//         };

//         albumAdd.onclick = () => {
//             playlistControl.addTracks(artist, album, filteredTracks, false);
//         };

//         newTrackList.className = 'table';

//         filteredTracks.forEach((track) => {
//             const listRow = document.createElement('tr');
//             const playItem = document.createElement('td');
//             const addItem = document.createElement('td');
//             const listItem = document.createElement('td');
//             const readableTrackName = track.name.split('.').slice(0, -1).join(' ');

//             listRow.className = 'track-row';
//             playItem.innerHTML = 'play';
//             addItem.innerHTML = 'add';
//             listItem.innerHTML = readableTrackName;

//             playItem.addEventListener('click', (event) => {
//                 playlistControl.clearPlaylist();
//                 playlistControl.addTrack(artist, album, track, 0);
//             });

//             addItem.addEventListener('click', (event) => {
//                 playlistControl.addTrack(artist, album, track);
//             });

//             listRow.append(playItem, addItem, listItem);
//             trackListing.append(listRow);
//         });

//         trackList.append(newTrackList);
//     };
//     this.clear = function () {
//         const albumTitle = document.getElementById('album-title');
//         const albumPlay = document.getElementById('album-play');
//         const albumAdd = document.getElementById('album-add');
//         const trackList = document.getElementById('track-list');

//         albumTitle.innerHTML = '';
//         albumPlay.classList.add('hidden');
//         albumAdd.classList.add('hidden');

//         while (trackList.firstChild) {
//             trackList.removeChild(trackList.firstChild);
//         }
//     };
// }
function PlaylistControl(playlistAttachPoint, controlsAttachPoint) {
    const self = this;
    const controls = document.createElement('div');
    const nextButton = document.createElement('div');
    const nextButtonText = document.createElement('span');
    const repeatButton = document.createElement('div');
    const repeatButtonText = document.createElement('span');
    let repeat = false;

    const playlist = document.createElement('table');
    const trackHeader = document.createElement('thead');
    const trackHeaderRow = document.createElement('tr');
    const numberHeader = document.createElement('td');
    const titleHeader = document.createElement('td');
    const artistHeader = document.createElement('td');
    const albumHeader = document.createElement('td');
    const trackListing = document.createElement('tbody');
    const actionHandlers = [
        [
            'play',
            () => {
                audioController.play();
            },
        ],
        [
            'pause',
            () => {
                audioController.pause();
            },
        ],
        [
            'previoustrack',
            () => {
                self.previousTrack();
            },
        ],
        [
            'nexttrack',
            () => {
                self.nextTrack();
            },
        ],
        // [
        //     'stop',
        //     () => {
        //         audioController.stop()
        //     },
        // ],
        // [
        //     'seekbackward',
        //     (details) => {
        //         /* ... */
        //     },
        // ],
        // [
        //     'seekforward',
        //     (details) => {
        //         /* ... */
        //     },
        // ],
        // [
        //     'seekto',
        //     (details) => {
        //         /* ... */
        //     },
        // ],
    ];

    this.tracks = [];
    this.nextTrack = function () {
        // Check for last audio file in the playlist
        if (self.trackNumber === self.tracks.length - 1 && repeat) {
            self.trackNumber = 0;
        } else {
            self.trackNumber++;
        }

        self.pause();

        // Change the audio element source
        self.play(self.tracks[self.trackNumber]);
    };
    this.previousTrack = function () {};
    this.pause = function () {
        audioController.pause();
    };
    this.play = async function (track) {
        // Highlight current row
        trackListing.querySelectorAll('tr').forEach((row, index) => {
            row.classList.toggle('playing', index === self.trackNumber);
        });

        const audioController = document.getElementById('audio-controller');

        // Ensure now-playing UI exists
        let nowPlaying = document.getElementById('now-playing');
        if (!nowPlaying) {
            nowPlaying = document.createElement('div');
            nowPlaying.id = 'now-playing';
            nowPlaying.className = 'now-playing';
            nowPlaying.setAttribute('aria-live', 'polite');
            nowPlaying.innerHTML = `
      <div class="np-title" id="np-title">—</div>
      <div class="np-sub" id="np-sub">—</div>
    `;
            audioController.insertAdjacentElement('afterend', nowPlaying);
        }

        const npTitle = document.getElementById('np-title');
        const npSub = document.getElementById('np-sub');

        const fallbackTitle = track?.name || track?.path_lower?.split('/').pop() || 'Unknown title';

        // Set initial fallback immediately (feels snappy)
        npTitle.textContent = fallbackTitle;
        npSub.textContent = '';
        audioController.title = fallbackTitle;
        audioController.setAttribute('aria-label', `Now playing: ${fallbackTitle}`);

        try {
            const response = await apiFetch(baseURL + '/track', {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    path: track.path_lower,
                },
            });

            if (!response.ok) throw new Error(`Track fetch failed: ${response.status}`);

            const myBlob = await response.blob();
            const objectURL = URL.createObjectURL(myBlob);

            // Revoke previous object URL to avoid leaks
            const prev = audioController.dataset.objectUrl;
            if (prev) URL.revokeObjectURL(prev);
            audioController.dataset.objectUrl = objectURL;

            audioController.src = objectURL;
            audioController.load();

            jsmediatags.read(myBlob, {
                onSuccess: function (tag) {
                    const t = tag?.tags || {};

                    const title = (t.title || '').trim() || fallbackTitle;
                    const artist = (t.artist || '').trim();
                    const album = (t.album || '').trim();

                    // Update visible UI
                    npTitle.textContent = title;

                    const parts = [];
                    if (artist) parts.push(artist);
                    if (album) parts.push(album);

                    npSub.textContent = parts.join(' — ');

                    // Update audio element tooltip + accessibility label
                    const label = `Now playing: ${title}${artist ? ` by ${artist}` : ''}${album ? ` from ${album}` : ''}`;
                    audioController.title = label;
                    audioController.setAttribute('aria-label', label);

                    // MediaSession (lock screen / hardware keys)
                    if ('mediaSession' in navigator) {
                        let artwork;

                        // Optional embedded artwork
                        if (t.picture?.data && t.picture?.format) {
                            try {
                                const byteArray = new Uint8Array(t.picture.data);
                                const picBlob = new Blob([byteArray], { type: t.picture.format });
                                const artUrl = URL.createObjectURL(picBlob);
                                artwork = [{ src: artUrl, sizes: '512x512', type: t.picture.format }];
                            } catch (e) {
                                console.warn('Failed to build artwork URL:', e);
                            }
                        }

                        navigator.mediaSession.metadata = new MediaMetadata({
                            title,
                            artist: artist || 'Unknown artist',
                            album: album || 'Unknown album',
                            ...(artwork ? { artwork } : {}),
                        });

                        for (const [action, handler] of actionHandlers) {
                            try {
                                navigator.mediaSession.setActionHandler(action, handler);
                            } catch {
                                console.log(`The media session action "${action}" is not supported yet.`);
                            }
                        }
                    }
                },
                onError: function (error) {
                    console.warn('Tag read failed:', error);
                    // Keep fallbacks already set
                },
            });
        } catch (err) {
            console.error(err);
        }
    };
    this.playback = function (track) {
    this.playbak = function (track) {
        trackListing.querySelectorAll('tr').forEach((row, index) => {
            if (index === self.trackNumber) {
                row.classList.add('playing');
            } else {
                row.classList.remove('playing');
            }
        });

        apiFetch(baseURL + '/track', {
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8',
                path: track.path_lower,
            },
        }).then((response) => {
            response.blob().then((myBlob) => {
                const objectURL = URL.createObjectURL(myBlob);
                audioController.src = objectURL;

                jsmediatags.read(myBlob, {
                    onSuccess: function (tag) {
                        console.log(tag);
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: tag.tags.title,
                                artist: tag.tags.artist,
                                album: tag.tags.album,
                                // artwork: [
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '96x96',
                                //         type: 'image/png',
                                //     },
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '128x128',
                                //         type: 'image/png',
                                //     },
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '192x192',
                                //         type: 'image/png',
                                //     },
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '256x256',
                                //         type: 'image/png',
                                //     },
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '384x384',
                                //         type: 'image/png',
                                //     },
                                //     {
                                //         src: 'https://assets.codepen.io/4358584/1.300.jpg',
                                //         sizes: '512x512',
                                //         type: 'image/png',
                                //     },
                                // ],
                            });
                            for (const [action, handler] of actionHandlers) {
                                try {
                                    navigator.mediaSession.setActionHandler(action, handler);
                                } catch (error) {
                                    console.log(`The media session action "${action}" is not supported yet.`);
                                }
                            }
                        }
                    },
                    onError: function (error) {
                        console.log(error);
                    },
                });
            });
        });
    };
    this.addTrack = function (artist, album, track, index) {
        const trackRow = document.createElement('tr');
        const numberDescription = document.createElement('td');
        const titleDescription = document.createElement('td');
        const artistDescription = document.createElement('td');
        const albumDescription = document.createElement('td');

        self.tracks.push(track);

        titleDescription.innerHTML = track.name;
        artistDescription.innerHTML = artist.name;
        albumDescription.innerHTML = album.name;

        trackRow.className = 'track-row';
        trackRow.append(numberDescription, titleDescription, artistDescription, albumDescription);
        trackListing.append(trackRow);

        if (index === 0) {
            self.pause();
            numberDescription.innerHTML = index + 1;
            self.trackNumber = 0;
            self.play(track);
        } else {
            numberDescription.innerHTML = self.tracks.length;
        }
    };
    this.addTracks = function (artist, album, tracks, clearPlaylist = true) {
        if (clearPlaylist) {
            self.clearPlaylist();
            tracks.forEach((track, index) => {
                self.addTrack(artist, album, track, index);
            });
        } else {
            let adjustedLength = self.tracks.length;

            if (adjustedLength > 0) {
                tracks.forEach((track, index) => {
                    self.addTrack(artist, album, track, index + adjustedLength);
                });
            }
        }
    };
    this.clearPlaylist = function () {
        self.trackNumber = 0;
        self.tracks = [];

        for (const [action, handler] of actionHandlers) {
            try {
                try {
                    // Unset the "nexttrack" action handler at the end of a playlist.
                    navigator.mediaSession.setActionHandler('nexttrack', null);
                } catch (error) {
                    console.log(`The media session action "nexttrack" is not supported yet.`);
                }
            } catch (error) {
                console.log(`The media session action "${action}" is not supported yet.`);
            }
        }

        while (trackListing.firstChild) {
            trackListing.removeChild(trackListing.firstChild);
        }
    };

    playlist.className = 'table';

    titleHeader.innerHTML = 'Title';
    artistHeader.innerHTML = 'Artist';
    albumHeader.innerHTML = 'Album';

    trackHeaderRow.append(numberHeader, titleHeader, artistHeader, albumHeader);
    trackHeader.append(trackHeaderRow);

    nextButton.classList = 'control';
    nextButton.addEventListener('click', (event) => {
        self.nextTrack();
    });
    nextButtonText.innerHTML = 'NEXT!';
    nextButton.append(nextButtonText);

    repeatButton.classList = 'control';
    repeatButton.addEventListener('click', (event) => {
        repeat = !repeat;
    });
    repeatButtonText.innerHTML = 'AGAIN!';
    repeatButton.append(repeatButtonText);

    playlist.append(trackHeader, trackListing);
    controlsAttachPoint.append(nextButton, repeatButton);


    // controlsAttachPoint.append(controls);

    // Listen for the music ended event, to play the next audio file
    audioController.addEventListener('ended', this.nextTrack, false);
}
