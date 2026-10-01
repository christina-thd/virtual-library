# Development

Requires Node.js 20+. There are no npm dependencies, so there's nothing to install.

```sh
npm run dev     # http://localhost:3100, restarts on changes
npm test        # unit, HTTP and add-on packaging tests (Node's built-in test runner)
```

Search needs internet access (it asks the real catalogs); the tests don't.

| Variable       | Default             | Purpose                                              |
|----------------|---------------------|------------------------------------------------------|
| `PORT`         | `3100`              | Port to listen on                                    |
| `HOST`         | `0.0.0.0`           | Interface to bind                                    |
| `STATE_FILE`   | `data/library.json` | Where the library is saved                           |
| `COVERS_DIR`   | `data/covers`       | Where cover images are saved                         |
| `TMDB_API_KEY` | none                | Search movies and series on TMDB                     |
| `RAWG_API_KEY` | none                | Search games on RAWG                                 |

The server doesn't know about Home Assistant: in the add-on, `run.sh` reads the add-on options
with bashio and sets these variables.

## Layout

This folder is a Home Assistant add-on (the files at the top) that contains the app (the rest).

```
config.yaml, Dockerfile, run.sh     Home Assistant add-on
README.md, DOCS.md, CHANGELOG.md    add-on store page, Documentation tab, changelog

src/                      server (Node, no framework, no dependencies)
  server.js               entry point: load config and library, wire the parts, start HTTP, graceful shutdown
  config.js               environment variables
  app.js                  HTTP routes: page, static files, covers, API
  library/state.js        state shape, repairing saved data, the view sent to screens
  library/actions.js      every library action, validated (the only code that changes state)
  catalog/index.js        search: picks a provider per category, cleans up results, image allow-list
  catalog/providers/      one file per catalog: cinemeta, tvmaze, open-library, apple-books, steam, gog, nintendo, tmdb, rawg
  covers.js               saved cover images (CoverStore) and keeping them in step with the library
  catalog/runtimes.js     looks up movie durations in the background (provider.runtime), like covers
  http-client.js          fetch with a timeout and a User-Agent, for catalogs and images
  store.js                JSON file storage: debounced, atomic writes
  sse.js                  Server-Sent Events hub for live updates
  static.js               safe static file serving

public/                   browser (plain ES modules, no build step)
  index.html              the page (markup only)
  css/                    base.css (theme, shared components), home.css, shelf.css, search.css, details.css
  img/logo.svg            app logo and browser icon; icon-*.png home-screen icons
  manifest.webmanifest    web app manifest ("Add to Home Screen")
  js/app.js               entry: keeps the latest library, hands it to the views, switches home ↔ category
  js/shared/              library.js (categories and rules, also used by the server), api, dom, format, storage
  js/ui/                  reusable pieces: back (phone back button), sheet (bottom sheets, swipe to close),
                          viewport (keeps sheets above the keyboard), celebrate (confetti + message),
                          toast, cover, stars, icons
  js/library/             the views: home (category tiles), category (title + Pending / (Waiting) / Done tabs, sort), shelf (grid),
                          search (add), details (one item), cheers (the lines said when you finish something)

test/                     node:test suites
```

## How it works

**Data flow.** Screens send actions (`POST /api/actions`, e.g. `{ "type": "setStatus", "itemId": "…",
"status": "done" }`). The server validates and applies the action, saves, and broadcasts the new view
to every screen over `GET /api/events` (Server-Sent Events). Screens never change items locally; they
only render the latest view.

**Actions:** `addItem`, `setStatus`, `setDropped`, `rateItem`, `removeItem`. See `src/library/actions.js`.
Statuses are `pending`, `done` and, for series only, `waiting` (`statusesFor` in `public/js/shared/library.js`).
Only finished items can be rated; moving an item away from done clears its rating and its `dropped` mark
(dropped: given up on; it counts as done).

**Search.** `GET /api/search?category=movie&q=dune` asks the providers for that category, one after the
other until one finds something (a provider that's down is skipped), and returns
results in one shape: `{ category, title, year, creator, source: { provider, id }, coverUrl, thumbUrl }`.
The screen sends a result back as it is with `addItem`. `source` stops the same thing being added twice.

A provider is a small object: `{ id, name, url, imageHosts, search(query, http) }`. To add or swap one,
write a file in `src/catalog/providers/` and add it to its category's list in `chooseProviders`
(`src/catalog/index.js`), best first. TMDB and RAWG go first when their API key is set; the keyless ones stay as fallbacks.
A category can instead offer several sources to pick from (games: `pc` and `nintendo`, sent as `&source=`);
`/api/info` lists them per category with their credits, and the search screen shows a switch when there's more than one.

**Covers.** Items keep a list of image URLs, best first (e.g. a large poster, then the search thumbnail).
After every change, `createCoverSync` (`src/covers.js`) downloads covers that aren't saved yet, one at a
time in the background, trying each URL in turn, and deletes the files of removed items. Saved covers are
served from `/covers/<item id>.<ext>` with a long cache time (a file never changes). Until a cover is saved,
screens show the catalog's image directly.

The server only downloads images from the catalogs' own image servers (`imageHosts`), so an action can't make
it fetch arbitrary addresses. Errors from catalogs name the host but never the URL, which can hold an API key.

**Saved data** is versioned (`schema`). `normalizeState` repairs anything odd in the file on load
(unknown values fall back to defaults; items without a title are dropped), so a bad edit can't break the app.

**Updates while a page is open:** every view carries the app version; a page that sees a new
version reloads itself.

**Home and categories:** the page has two views, the home screen (`library/home.js`) and one category
(`library/category.js`). Switching doesn't load a new page; `app.js` shows one view or the other.

**Back button:** opening a category or a sheet (search, an item) adds a history entry, so the phone's back
button (and the Home Assistant app's) undoes it instead of leaving the page. `js/ui/back.js` keeps one handler
per entry; going back runs the newest (close the item, then the search, then return home).

**Paths are relative** (`api/actions`, `css/…`, `covers/…`), so the app also works in the Home Assistant
sidebar, which serves it under `/api/hassio_ingress/<token>/`.

## Releasing a new version

1. Bump `version` in **both** `config.yaml` and `package.json` (a test fails if they differ).
2. Add an entry at the top of `CHANGELOG.md`.
3. Run `npm test`, then commit and push. Home Assistant shows the update in the add-on store.

The library is kept in the add-on's `/data` folder across updates.

## Store images

`icon.png` (128×128) and `logo.png` (250×100) are what Home Assistant shows in the add-on store.
They are rendered from `public/img/logo.svg` and `art/store-logo.svg`, together with the home-screen
icons in `public/img/`; after changing either, run:

```sh
docker run --rm -v "$PWD:/addon" -w /addon alpine:3.20 sh art/render.sh
```

## Testing the add-on image locally

```sh
docker build --build-arg BUILD_ARCH=amd64 -t virtual-library .    # BUILD_FROM defaults to the Home Assistant base image
docker run --rm -p 3100:3100 -v virtual-library-data:/data --add-host supervisor:127.0.0.1 virtual-library
```

`run.sh` reads the add-on options from the Home Assistant Supervisor. Outside Home Assistant there
is none, so `--add-host` makes that lookup fail fast (it logs harmless errors) and the keyless catalogs are used.
