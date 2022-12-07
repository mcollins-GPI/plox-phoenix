# this script will grab part of a single song and extract the id3 tag info from it
# mutagen stuff doesn't currently work, but if the IOInterface is implemented it should be possible

import requests
from id3parse import ID3
# import json
# import io
# from mutagen.id3 import ID3
# from mutagen.mp3 import MP3


class IOInterface(object):
    """This is the interface mutagen expects from custom file-like
    objects.

    For loading read(), tell() and seek() have to be implemented. "name"
    is optional.

    For saving/deleting write(), flush() and truncate() have to be
    implemented in addition. fileno() is optional.
    """

    # For loading

    def tell(self):
        """Returns he current offset as int. Always >= 0.

        Raises IOError in case fetching the position is for some reason
        not possible.
        """

        raise NotImplementedError

    def read(self, size=-1):
        """Returns 'size' amount of bytes or less if there is no more data.
        If no size is given all data is returned. size can be >= 0.

        Raises IOError in case reading failed while data was available.
        """

        raise NotImplementedError

    def seek(self, offset, whence=0):
        """Move to a new offset either relative or absolute. whence=0 is
        absolute, whence=1 is relative, whence=2 is relative to the end.

        Any relative or absolute seek operation which would result in a
        negative position is undefined and that case can be ignored
        in the implementation.

        Any seek operation which moves the position after the stream
        should succeed. tell() should report that position and read()
        should return an empty bytes object.

        Returns Nothing.
        Raise IOError in case the seek operation asn't possible.
        """

        raise NotImplementedError

    # For loading, but optional

    @property
    def name(self):
        """Should return text. For example the file name.

        If not available the attribute can be missing or can return
        an empty string.

        Will be used for error messages and type detection.
        """

        raise NotImplementedError

    # For writing

    def write(self, data):
        """Write data to the file.

        Returns Nothing.
        Raises IOError
        """

        raise NotImplementedError

    def truncate(self, size=None):
        """Truncate to the current position or size if size is given.

        The current position or given size will never be larger than the
        file size.

        This has to flush write buffers in case writing is buffered.

        Returns Nothing.
        Raises IOError.
        """

        raise NotImplementedError

    def flush(self):
        """Flush the write buffer.

        Returns Nothing.
        Raises IOError.
        """

        raise NotImplementedError

    # For writing, but optional

    def fileno(self):
        """Returns the file descriptor (int) or raises IOError
        if there is none.

        Will be used for low level operations if available.
        """

        raise NotImplementedError

def getMutagenTags(path):
    """"""
    audio = ID3.load(path)

    print("Artist: %s" % audio['TPE1'].text[0])
    print("Track: %s" % audio["TIT2"].text[0])
    print("Release Year: %s" % audio["TDRC"].text[0])


url = "https://content.dropboxapi.com/2/files/download"

# the range header is key to reducing the bandwidth requirement, and could be used in javascript request
headers = {
    "Authorization": "Bearer sl.BUj1QlhqS2jjmTfeIGTWvNozlZhOezfAoJ2wOGkdrY1kLtRtQNcSMuz95uJdakmW-fweZf3zVHSHK1Wn4zRQsm7qVdFjLH0dGetvhmFeZIQmYMgZ6YIDBDCHvwfGYiavA6kNmJiC",
    "Dropbox-API-Arg": "{\"path\":\"/music/2 Chainz/Based On A T.R.U. Story (Deluxe) [2012]/02 Crack.mp3\"}",
    "Range": "bytes=0-1023"
}

r = requests.post(url, headers=headers)

id3 = ID3.from_byte_array(r.content)

for f in id3.frames:
    print(f)
