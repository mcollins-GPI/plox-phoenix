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
        const newArtistTitle = document.createElement('h1');
        const newArtistList = document.createElement('ul');

        newArtistTitle.innerHTML = `Artists (${artists.length})`;

        artists.forEach((artist) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = artist.name;
            listItem.addEventListener('click', (event) => {
                fetch(`http://localhost/plox-phoenix/data/album`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        artist: artist.name,
                    },
                })
                    .then((response) => response.json())
                    .then((data) => albumListControl.populate(artist, data.album_list));
            });

            newArtistList.append(listItem);
        });

        self.clear();
        attachPoint.append(newArtistTitle, newArtistList);
    };
    this.clear = function () {
        while (attachPoint.firstChild) {
            attachPoint.removeChild(attachPoint.firstChild);
        }
    };

    fetch('http://localhost/plox-phoenix/data/artist')
        .then((response) => response.json())
        .then((data) => self.populate(data.artist_list));
}
function AlbumListControl(attachPoint) {
    const self = this;

    this.populate = function (artist, albums) {
        const newAlbumTitle = document.createElement('h1');
        const newAlbumList = document.createElement('ul');

        newAlbumTitle.innerHTML = `${artist.name}`;

        albums.forEach((album) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = album.name;

            // console.log(album);
            listItem.addEventListener('click', (event) => {
                fetch(`http://localhost/plox-phoenix/data/tracks`, {
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

            newAlbumList.append(listItem);
        });

        self.clear();
        attachPoint.append(newAlbumTitle, newAlbumList);
    };
    this.clear = function () {
        while (attachPoint.firstChild) {
            attachPoint.removeChild(attachPoint.firstChild);
        }
    };
}
function TrackListControl(attachPoint) {
    const self = this;

    this.populate = function (artist, album, tracks) {
        const newAlbumTitle = document.createElement('h1');
        const playAlbumButton = document.createElement('div');
        const newTrackList = document.createElement('ul');

        playAlbumButton.innerHTML = 'play stuff!';

        playAlbumButton.addEventListener('click', () => {
            playlistControl.addTracks(artist, album, tracks);
        });

        newAlbumTitle.innerHTML = `${album.name}`;

        tracks.forEach((track) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = track.name;

            listItem.addEventListener('click', (event) => {
                fetch(`http://localhost/plox-phoenix/data/track`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        path: track.path_lower,
                    },
                }).then((response) => {
                    response.blob().then((myBlob) => {
                        const objectURL = URL.createObjectURL(myBlob);
                        audioController.src = objectURL;
                    });
                });
            });

            newTrackList.append(listItem);
        });

        self.clear();
        attachPoint.append(newAlbumTitle, playAlbumButton, newTrackList);
    };
    this.clear = function () {
        while (attachPoint.firstChild) {
            attachPoint.removeChild(attachPoint.firstChild);
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
    const trackListing = document.createElement('tbody');
    const numberHeader = document.createElement('td');
    const titleHeader = document.createElement('td');
    const artistHeader = document.createElement('td');
    const albumHeader = document.createElement('td');

    this.nextTrack = function () {
        // Check for last audio file in the playlist
        if (self.trackNumber === self.tracks.length - 1) {
            self.trackNumber = 0;
        } else {
            self.trackNumber++;
        }

        // Change the audio element source
        fetch(`http://localhost/plox-phoenix/data/track`, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8',
                path: self.tracks[self.trackNumber].path_lower,
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
    this.previousTrack = function () {};
    this.addTrack = function (artist, album, track, index) {
        const trackRow = document.createElement('tr');
        const numberDescription = document.createElement('td');
        const titleDescription = document.createElement('td');
        const artistDescription = document.createElement('td');
        const albumDescription = document.createElement('td');

        numberDescription.innerHTML = index + 1;
        titleDescription.innerHTML = track.name;
        artistDescription.innerHTML = artist.name;
        albumDescription.innerHTML = album.name;

        trackRow.append(numberDescription, titleDescription, artistDescription, albumDescription);
        trackListing.append(trackRow);

        if (index === 0) {
            self.trackNumber = 0;
            fetch(`http://localhost/plox-phoenix/data/track`, {
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
        }
    };
    this.addTracks = function (artist, album, tracks) {
        self.clearPlaylist();
        self.tracks = tracks;
        tracks.forEach((track, index) => {
            self.addTrack(artist, album, track, index);
        });
    };
    this.clearPlaylist = function () {
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
