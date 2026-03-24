# plox-phoenix

## things to work on

- header section
    - none
- artist section
    - none
- album section
    - none
- tracklist section
    - none
- media section
    - none
- general
    - add google cast support
    - store parsed media information so that it doesn't have to read tags every time
    - see what other people are streaming (social features)

## completed

- stream music from the server instead of loading full track before playback
- buffered download fallback when streaming fails (blob URL via /track route)
- container format buffering (m4a, aac, mp4, webm) for non-range requests
- gapless playback with dual audio elements and preloading
- improved mobile usability and responsive behavior
    - full-width accordion layout for narrow screens
    - three-column CSS Grid desktop layout (≥992px) with expandable player
    - responsive topbar with icon mode at ≤640px
    - simplified player at ≤640px, two-row layout at ≤500px
    - progressive playlist table columns: hide drag (≤640px), album (≤540px), artist (≤500px)
    - playlist drag-and-drop reordering
- have server request media tags and display them responsively
    - title marquee scrolling for overflowing track names
- SVG icon system replacing all emoji/Unicode glyphs
- refined button styling (gradients, inset shadows, hover/active states)
- Unicode normalization (NFD→NFC) for Dropbox file/folder names
- button-group style artist letter filter

## resources

- https://web.dev/media-session/
- https://github.com/jonathantneal/media-player
- https://www.dropbox.com/developers/documentation/javascript#tutorial
- https://www.fastify.io/
- https://www.postgresql.org/
- https://github.com/goldfire/howler.js#quick-start
