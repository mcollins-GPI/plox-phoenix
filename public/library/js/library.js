const mediaPicker = document.getElementById('media-picker');
const artistList = document.getElementById('artist-list');
const albumList = document.getElementById('album-list');
const trackList = document.getElementById('track-list');
const mediaPlayer = document.getElementById('media-player');
const playList = document.getElementById('play-list');
const audioController = document.getElementById('audio-controller');
const artistListControl = new ArtistListControl(artistList);
const albumListControl = new AlbumListControl(albumList);
const trackListControl = new TrackListControl(trackList);
const playlistControl = new PlaylistControl(playList);

function TrackListControl(attachPoint) {
    const self = this;

    this.populate = function (album, tracks) {
        const newAlbumTitle = document.createElement('h1');
        const playAlbumButton = document.createElement('div');
        const newTrackList = document.createElement('ul');

        playAlbumButton.innerHTML = 'play stuff!';

        playAlbumButton.addEventListener('click', () => {
            playlistControl.addTracks(tracks);
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
                fetch(`http://localhost/plox-phoenix/data/tracks`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        artist: artist.name,
                        album: album.name,
                    },
                })
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

function PlaylistControl(attachPoint) {
    const self = this;
    this.domNode = document.createElement('table');

    const jsmediatags = window.jsmediatags; // read metadata from track being loaded
    const trackHeaders = document.createElement('theader');
    const trackListing = document.createElement('tbody');
    const numberHeader = document.createElement('td');
    const titleHeader = document.createElement('td');
    const artistHeader = document.createElement('td');
    const albumHeader = document.createElement('td');

    titleHeader.innerHTML = 'Title';
    artistHeader.innerHTML = 'Artist';
    albumHeader.innerHTML = 'Album';

    trackHeaders.append(numberHeader, titleHeader, artistHeader, albumHeader);

    this.addTrack = function (track, index) {
        const trackRow = document.createElement('tr');
        const number = document.createElement('td');
        const title = document.createElement('td');
        const artist = document.createElement('td');
        const album = document.createElement('td');

        // jsmediatags.read(track, {
        //     onSuccess: function (tag) {
        //         console.log(tag);
        //         title.innerHTML = tag.tags.title;
        //         artist.innerHTML = tag.tags.artist;
        //         album.innerHTML = tag.tags.album;
        //     },
        //     onError: function (error) {
        //         console.log(error);
        //         title.innerHTML = 'no title info';
        //         artist.innerHTML = 'no artist info';
        //         album.innerHTML = 'no album info';
        //     },
        // });

        // fetch(`http://localhost/plox-phoenix/data/track-info`, {
        //     method: 'GET',
        //     headers: {
        //         'Content-Type': 'text/plain;charset=UTF-8',
        //         path: track.path_lower,
        //     },
        // }).then((response) => {
        //     console.log(response);
        //     response.json().then((data) => {
        //         console.log(data);
        //     });
        // });

        number.innerHTML = index + 1;
        title.innerHTML = track.name;

        trackRow.append(number, title, artist, album);
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
    this.addTracks = function (tracks) {
        self.clearPlaylist();
        self.tracks = tracks;
        tracks.forEach((track, index) => {
            self.addTrack(track, index);
        });
    };
    this.clearPlaylist = function () {
        while (trackListing.firstChild) {
            trackListing.removeChild(trackListing.firstChild);
        }
    };

    this.domNode.append(trackHeaders, trackListing);

    attachPoint.append(this.domNode);

    // Listen for the music ended event, to play the next audio file
    audioController.addEventListener(
        'ended',
        () => {
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
                });
            });
        },
        false
    );
}

// curl -X POST https://content.dropboxapi.com/2/files/download \
//     --header "Authorization: Bearer sl.BUJhYyXpUjLencYxQDM3VS6LqdwBHf90mPjpvYK13tCYPE-yMedgYl3jQJ3s-56wjKigIS-TR83xzy4lJOtOUPIuKhwvd1ZOTlXzYjaenaXMpheOqrkd-i9kgmcZR--xyVJD9pBN" \
//     --header "Dropbox-API-Arg: {\"path\":\"/Homework/math/Prime_Numbers.txt\"}"

//     const rawResponse = await fetch('https://httpbin.org/post', {
//         method: 'POST',
//         headers: {
//           'Accept': 'application/json',
//           Authorization: Bearer sl.BUJhYyXpUjLencYxQDM3VS6LqdwBHf90mPjpvYK13tCYPE-yMedgYl3jQJ3s-56wjKigIS-TR83xzy4lJOtOUPIuKhwvd1ZOTlXzYjaenaXMpheOqrkd-i9kgmcZR--xyVJD9pBN
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({a: 1, b: 'Textual content'})
//       });
//       const content = await rawResponse.json();

//       console.log(content);

const params = new URLSearchParams({
    code: 'sl.BUJhYyXpUjLencYxQDM3VS6LqdwBHf90mPjpvYK13tCYPE-yMedgYl3jQJ3s-56wjKigIS-TR83xzy4lJOtOUPIuKhwvd1ZOTlXzYjaenaXMpheOqrkd-i9kgmcZR--xyVJD9pBN',
    grant_type: 'authorization_code',
    client_id: 'chd4jap4680m01b',
    client_secret: 'tcdwbbyvhe182ed',
});

fetch('https://api.dropboxapi.com/2/auth/token/from_oauth1', {
    method: 'POST',
    body: params,
})
    .then((res) => res.json())
    .then((data) => console.log('access data =>', data))
    .catch((err) => console.log('access err =>', err));
