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
        const titleContainer = document.createElement('div');
        const newAlbumTitle = document.createElement('div');
        const playAlbumButton = document.createElement('div');
        const addAlbumButton = document.createElement('div');
        const newTrackList = document.createElement('table');
        const trackHeader = document.createElement('thead');
        const trackHeaderRow = document.createElement('tr');
        const titleHeader = document.createElement('td');
        const playHeader = document.createElement('td');
        const addHeader = document.createElement('td');
        const trackListing = document.createElement('tbody');

        titleHeader.innerHTML = 'Title';

        trackHeaderRow.append(playHeader, addHeader, titleHeader);
        trackHeader.append(trackHeaderRow);
        newTrackList.append(trackHeader, trackListing);

        titleContainer.className = 'title-container';
        playAlbumButton.className = 'control';
        playAlbumButton.innerHTML = 'PLAY!';

        playAlbumButton.addEventListener('click', () => {
            playlistControl.addTracks(artist, album, tracks);
        });

        addAlbumButton.className = 'control';
        addAlbumButton.innerHTML = 'ADD!';

        addAlbumButton.addEventListener('click', () => {
            playlistControl.addTracks(artist, album, tracks, false);
        });

        newAlbumTitle.innerHTML = `${album.name}`;
        newAlbumTitle.className = 'title-text';
        newTrackList.className = 'table';

        tracks.forEach((track) => {
            const listRow = document.createElement('tr');
            const playItem = document.createElement('td');
            const addItem = document.createElement('td');
            const listItem = document.createElement('td');

            playItem.innerHTML = 'play';
            addItem.innerHTML = 'add';
            listItem.innerHTML = track.name;

            playItem.addEventListener('click', (event) => {
                playlistControl.addTrack(artist, album, track);
            });

            addItem.addEventListener('click', (event) => {
                playlistControl.addTrack(artist, album, track, false);
            });

            listRow.append(playItem, addItem, listItem);
            trackListing.append(listRow);
        });

        self.clear();
        titleContainer.append(newAlbumTitle, playAlbumButton, addAlbumButton);
        attachPoint.append(titleContainer, newTrackList);
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
