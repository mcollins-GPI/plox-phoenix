const baseURL = 'http://localhost/plox-phoenix/data';
// const baseURL = 'https://mcee.dev/dropsonic/data';
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
                fetch(baseURL + '/album', {
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

    fetch(baseURL + '/artist')
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
                    fetch(baseURL + '/tracklist', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'text/plain;charset=UTF-8',
                            artist: artist.name,
                            album: album.name,
                        },
                    })
                        .then((response) => response.json())
                        .then((data) => trackListControl.populate(artist, album, data.tracklist));
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

    this.populate = function (artist, album, tracks) {
        const filteredTracks = tracks.filter((track) => {
            let fileType = track.name.split('.').pop();
            // omit hidden files and excluded files from track list
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

        filteredTracks.forEach((track) => {
            const listRow = document.createElement('tr');
            const playItem = document.createElement('td');
            const addItem = document.createElement('td');
            const listItem = document.createElement('td');
            const readableTrackName = track.name.split('.').slice(0, -1).join(' ');

            listRow.className = 'track-row';
            playItem.innerHTML = 'play';
            addItem.innerHTML = 'add';
            listItem.innerHTML = readableTrackName;

            playItem.addEventListener('click', (event) => {
                playlistControl.clearPlaylist();
                playlistControl.addTrack(artist, album, track, 0);
            });

            addItem.addEventListener('click', (event) => {
                playlistControl.addTrack(artist, album, track);
            });

            listRow.append(playItem, addItem, listItem);
            trackListing.append(listRow);
        });

        trackList.append(newTrackList);
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
function PlaylistControl(playlistAttachPoint, controlsAttachPoint) {
    const self = this;
    const controls = document.createElement('div');
    const nextButton = document.createElement('div');
    const nextButtonText = document.createElement('span');
    const repeatButton = document.createElement('div');
    const repeatButtonText = document.createElement('span');
    let repeat = false;

    const testButton = document.createElement('div');
    const testButtonText = document.createElement('span');

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
    this.play = function (track) {
        trackListing.querySelectorAll('tr').forEach((row, index) => {
            if (index === self.trackNumber) {
                row.classList.add('playing');
            } else {
                row.classList.remove('playing');
            }
        });

        fetch(baseURL + '/track', {
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
    repeatButtonText.innerHTML = 'REPEAT!';
    repeatButton.append(repeatButtonText);

    testButton.classList = 'control';
    testButton.addEventListener('click', (event) => {
        //     var xhr = new XMLHttpRequest();
        //     // xhr.responseType = 'octet-stream';
        //     xhr.responseType = 'arraybuffer';

        //     xhr.onload = async function () {
        //         if (xhr.status === 200) {
        //             // var blob = new Blob([xhr.response], { type: 'application/octet-stream' });
        //             // console.log(blob);
        //             console.log(xhr.response);

        //             const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        //             const source = audioCtx.createBufferSource();

        //             // set the buffer in the AudioBufferSourceNode
        //             source.buffer = xhr.response;

        //             // connect the AudioBufferSourceNode to the
        //             // destination so we can hear the sound
        //             source.connect(audioCtx.destination);

        //             // start the source playing
        //             source.start();

        //         } else {
        //             var errorMessage = xhr.response || 'Unable to download file';
        //             // Upload failed. Do something here with the error.
        //         }
        //     };

        //     xhr.open('POST', 'https://content.dropboxapi.com/2/files/download');
        //     xhr.setRequestHeader(
        //         'Authorization',
        //         'Bearer sl.BUnX0BZ37g6fIlQHgcXvX9ttGOzP8HoIhDOIyaYCmSCMDNBiFXpCo1H8fzVdPXtDbCSyFQzwPlrQLZ3e5ZOD-5LsPW5hJfHeJzKNwh2d2GPjYeE3KbFaoSzTfBjNooIEJIKX2lyV'
        //     );
        //     xhr.setRequestHeader(
        //         'Dropbox-API-Arg',
        //         JSON.stringify({
        //             path: '/Music/LCD Soundsystem/45:33 [2007]/01 45-33.mp3',
        //         })
        //     );
        //     xhr.send();

        var headers = {
            authorization: 'Bearer sl.BUlDhZkOPzqLQsOLrkoMgMiOcgqUUFMyJim1IRHAOk3zAeiUXQU4H2PsA_33_LMMk6LKl9tptZtDFa2rg5ndjBW3MPUIW2FvwoQWR9A627-wsg2uOkQ8nHo6ciuy_YXitSf_KFSI',
            arg: '{"path":"/music/2 Chainz/Based On A T.R.U. Story (Deluxe) [2012]/02 Crack.mp3"}',
            range: 'bytes=0-1023',
        };
        // var params = JSON.stringify({
        //     id: 'id:LNWjzwt30FUAAAAAAABFkA',
        // });

        fetch('https://api.dropboxapi.com/2/file_requests/get', {
            method: 'POST',
            mode: 'no-cors', // no-cors, *cors, same-origin
            // body: params,
            headers: headers,
        })
            .then((res) => console.log(res))
            // .then((data) => console.log('access data =>', data))
            .catch((err) => console.log('access err =>', err));

        // fetch('https://content.dropboxapi.com/2/files/download', {
        //     method: 'POST', // *GET, POST, PUT, DELETE, etc.
        //     mode: 'no-cors', // no-cors, *cors, same-origin
        //     cache: 'default', // *default, no-cache, reload, force-cache, only-if-cached
        //     credentials: 'same-origin', // include, *same-origin, omit
        //     headers: {
        //         Authorization:
        //             'Bearer sl.BUnX0BZ37g6fIlQHgcXvX9ttGOzP8HoIhDOIyaYCmSCMDNBiFXpCo1H8fzVdPXtDbCSyFQzwPlrQLZ3e5ZOD-5LsPW5hJfHeJzKNwh2d2GPjYeE3KbFaoSzTfBjNooIEJIKX2lyV',
        //     },
        //     body: JSON.stringify({ path: '/music/LCD Soundsystem/45:33 [2007]/01 45-33.mp3' }),
        //     redirect: 'follow', // manual, *follow, error
        //     referrer: 'client', // no-referrer, *client
        // })
        //     .then((response) => {
        //         console.log(response);
        //         // reply.type('application/octet-stream');
        //         // reply.send(response);

        //         // const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        //         // const url = window.URL.createObjectURL(blob);
        //         // audioElement.src = url;
        //         // if (response.status === 200) {
        //         //     if (type === 'json') {
        //         //         return response.json().then((data) => {
        //         //             return data;
        //         //         });
        //         //     } else if (type === 'blob') {
        //         //         return response;
        //         //     }
        //         // } else {
        //         //     return Promise.resolve({
        //         //         features: [],
        //         //         type: 'FeatureCollection',
        //         //     });
        //         // }
        //     })

        //     .catch((error) => console.log(error));
    });
    testButtonText.innerHTML = 'STREAM!';
    testButton.append(testButtonText);

    playlist.append(trackHeader, trackListing);
    controls.append(nextButton, repeatButton);
    // controls.append(testButton);

    playlistAttachPoint.append(playlist);
    controlsAttachPoint.append(controls);

    // Listen for the music ended event, to play the next audio file
    audioController.addEventListener('ended', this.nextTrack, false);
}
