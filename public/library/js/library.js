const mediaPicker = document.getElementById('media-picker');
const artistList = document.getElementById('artist-list');
const albumList = document.getElementById('album-list');
const trackList = document.getElementById('track-list');
const mediaPlayer = document.getElementById('media-player');
const audioController = document.getElementById('audio-controller');
const artistListControl = new ArtistListControl(artistList);
const albumListControl = new AlbumListControl(albumList);
const trackListControl = new TrackListControl(trackList);

function TrackListControl(attachPoint) {
    const self = this;

    this.populate = function (album, tracks) {
        const newAlbumTitle = document.createElement('h1');
        const playAlbumButton = document.createElement('div');
        const newTrackList = document.createElement('ul');

        playAlbumButton.innerHTML = 'play stuff!';

        playAlbumButton.addEventListener('click', () => {
            let i = 0;

            function next() {
                // Check for last audio file in the playlist
                if (i === tracks.length - 1) {
                    i = 0;
                } else {
                    i++;
                }

                // Change the audio element source
                fetch(`http://localhost/plox-phoenix/data/track`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        path: tracks[i].path_lower,
                    },
                }).then((response) => {
                    response.blob().then((myBlob) => {
                        const objectURL = URL.createObjectURL(myBlob);
                        audioController.src = objectURL;
                    });
                });
            }

            // Check if the player is selected

            fetch(`http://localhost/plox-phoenix/data/track`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    path: tracks[i].path_lower,
                },
            }).then((response) => {
                response.blob().then((myBlob) => {
                    const objectURL = URL.createObjectURL(myBlob);
                    audioController.src = objectURL;
                });
            });

            // Listen for the music ended event, to play the next audio file
            audioController.addEventListener('ended', next, false);
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
                fetch(`http://localhost/plox-phoenix/data/tracks/${artist.name}/${album.name}`)
                    .then((response) => response.json())
                    .then((data) => trackListControl.populate(album, data.track_list));
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
                fetch(`http://localhost/plox-phoenix/data/album/${artist.name}`)
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