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

function ArtistListControl(attachPoint) {
    const self = this;

    this.populate = function (artists) {
        const artistsSorted = artists
            .filter((artist) => {
                return artist['.tag'] === 'folder';
            })
            .sort((a, b) => {
                const nameA = a.name.toUpperCase(); // ignore upper and lowercase
                const nameB = b.name.toUpperCase(); // ignore upper and lowercase
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
            const artistFirstLetter = artist.name.slice(0, 1).toUpperCase();

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
                    .then((data) => albumListControl.populate(artist, data.album_list));
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

            albumRow.className = 'album-row';
            albumItem.innerHTML = album.name;
            albumRow.addEventListener('click', (event) => {
                fetch(baseURL + '/tracks', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        artist: artist.name,
                        album: album.name,
                    },
                })
                    .then((response) => response.json())
                    .then((data) => trackListControl.populate(artist, album, data.track_list));
            });

            albumRow.append(albumItem);
            albumListing.append(albumRow);
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
    const imageFileTypes = ['.jpg', '.png'];

    this.populate = function (artist, album, tracks) {
        const filteredTracks = tracks.filter((track) => {
            imageFileTypes.forEach((imageFileType) => {
                if (track.name.endsWith(imageFileType)) {
                    return false;
                }
            });
            return true;
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

        albumTitle.innerHTML = `${album.name}`;
        albumTitle.className = 'title-text';
        playHeader.innerHTML = 'play';
        addHeader.innerHTML = 'add';
        titleHeader.innerHTML = 'Title';

        trackHeaderRow.append(playHeader, addHeader, titleHeader);
        trackHeader.append(trackHeaderRow);
        newTrackList.append(trackHeader, trackListing);

        albumPlay.className = 'control';
        albumPlay.innerHTML = 'PLAY!';

        albumPlay.addEventListener('click', () => {
            playlistControl.addTracks(artist, album, tracks);
        });

        albumAdd.className = 'control';
        albumAdd.innerHTML = 'ADD!';

        albumAdd.addEventListener('click', () => {
            playlistControl.addTracks(artist, album, tracks, false);
        });

        newTrackList.className = 'table';

        filteredTracks.forEach((track) => {
            const listRow = document.createElement('tr');
            const playItem = document.createElement('td');
            const addItem = document.createElement('td');
            const listItem = document.createElement('td');

            listRow.className = 'track-row';
            playItem.innerHTML = 'play';
            addItem.innerHTML = 'add';
            listItem.innerHTML = track.name;

            playItem.addEventListener('click', (event) => {
                playlistControl.addTrack(artist, album, track, 0);
            });

            addItem.addEventListener('click', (event) => {
                playlistControl.addTrack(artist, album, track);
            });

            listRow.append(playItem, addItem, listItem);
            trackListing.append(listRow);
        });

        self.clear();

        trackList.append(newTrackList);
    };
    this.clear = function () {
        const trackList = document.getElementById('track-list');

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
    const playlist = document.createElement('table');
    const trackHeader = document.createElement('thead');
    const trackHeaderRow = document.createElement('tr');
    const numberHeader = document.createElement('td');
    const titleHeader = document.createElement('td');
    const artistHeader = document.createElement('td');
    const albumHeader = document.createElement('td');
    const trackListing = document.createElement('tbody');

    this.tracks = [];
    this.nextTrack = function () {
        // Check for last audio file in the playlist
        if (self.trackNumber === self.tracks.length - 1) {
            self.trackNumber = 0;
        } else {
            self.trackNumber++;
        }

        // Change the audio element source
        self.play(self.tracks[self.trackNumber]);
    };
    this.previousTrack = function () {};
    this.play = function (track) {
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
                        // title.innerHTML = tag.tags.title;
                        // artist.innerHTML = tag.tags.artist;
                        // album.innerHTML = tag.tags.album;
                    },
                    onError: function (error) {
                        console.log(error);
                        // title.innerHTML = 'no title info';
                        // artist.innerHTML = 'no artist info';
                        // album.innerHTML = 'no album info';
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

        trackRow.append(numberDescription, titleDescription, artistDescription, albumDescription);
        trackListing.append(trackRow);

        if (index === 0) {
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

    playlist.append(trackHeader, trackListing);
    controls.append(nextButton);

    playlistAttachPoint.append(playlist);
    controlsAttachPoint.append(controls);

    // Listen for the music ended event, to play the next audio file
    audioController.addEventListener('ended', this.nextTrack, false);
}
