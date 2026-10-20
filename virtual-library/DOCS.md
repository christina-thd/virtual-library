# Hoard Board Add-on Documentation

Hoard Board keeps a personal library of movies, series, books, manga, comics and games: what you've finished,
and what's still pending.

## Usage

1. Install and start the add-on, and turn on **Show in sidebar**
2. Open **Hoard Board** in the Home Assistant sidebar. On your phone, use the Home Assistant app
   (it's in the app's sidebar too).
3. Tap **+**, pick the kind by its icon (movie, series, book, manga/comics, game), and type a title
4. Tap **Pending** or **Done** next to the right result

The first time, the app helps you set up: pick the categories you use, then add what you've already watched,
read and played. Tap **Start stats** on the home screen when you're done. What you finished while setting up counts
in the totals, but in no month or year: you'd seen it before. To add more past things later (say, a category you've
just switched on), tap **⋯** at the top right, then **Add already seen**, and **Done** on the home screen when you've added them.
Anything marked done until then counts as seen before; nothing else changes.

### The library

- The home screen has one tile per kind (Movies, Series, Books, Manga/Comics, Games), with how many are pending
  and done, and a few random covers. Tap a tile to open it; the back button (or ‹) returns home.
- Don't use a category? Tap **⋯** at the top right of the home screen and switch it off. It leaves the home
  screen, the stats and the search, but everything in it is kept: switch it back on any time. One always stays on.
- In each kind, **Pending** is everything you haven't seen, read or played yet, or haven't finished.
  **Done** is everything you've finished. Each kind opens on Pending, what you added or changed last first; Done starts with your best rated.
  Use the sort button next to the tabs for name, rating (on Done) or length: a movie's duration, a series' seasons,
  a book's or comic's pages, a manga's volumes, or the hours you played a game (on Done). Games can also be sorted by
  platform, and Manga/Comics by type (comics first). The arrow next to it turns any order the other way round.
- Looking for something? Tap the search icon next to the kind's title and type: it finds things by title or creator,
  on every tab (the tabs show how many match). **✕** closes it.
- On a long list, the arrows above **+** take you to the top or the bottom.
- **Series** have a third tab, **Waiting**: series you've caught up on, waiting for a new season. Move a series there
  from its page; when the new season is out, move it back to Pending.
- Tap a cover to open it: move it between Pending, (Waiting) and Done, rate it, or remove it. A finished game also
  has a **Playtime** field and a note (the button next to Playtime), if you want to keep track; a game with a note has
  a small badge on its cover. A rating, playtime or note is saved with **Save**; closing with changes not saved asks first.
- **Left off at** (the bookmark button on an item's page) keeps your place: the page of a pending book or comic, the volume
  of a pending manga, or the season and episode of a series in Pending or Waiting (picked from a list), never past the end.
  It shows on the cover's card too. **✕** clears it, and finishing the item clears it too. It isn't counted in the stats.
- Gave up on something because it wasn't worth finishing? Tap **Dropped it** on its page. It goes to Done (no confetti),
  greyed out with a red **Dropped** band across its cover. Tap it again to undo, or move it back to Pending.
- **+** inside a kind adds to that kind only (e.g. "Add a game"). **+** on the home screen lets you pick the kind
  (it starts on the one you picked last).
- To close the search or an item, tap **Close** (or **Back to search**), swipe it down from the top, or use your phone's back button.
- After adding something, its search result says **✓ Added to Pending** (or Done); tap it to open the item.
- **Stats** (the chart button at the top of the home screen): what you finished each month over the last year,
  your streak of months in a row, your top genres and creators (directors, networks, authors), the publishers of your comics (Marvel, DC…), totals
  (hours of movies, episodes, pages, manga volumes, comics read, playtime), records (the longest movie, biggest book…), release decades
  (for movies, series and books), ratings, the oldest thing still pending, and a year in review (tap its total, or a
  category's count, to see what you finished). For the whole library or one kind. Dropped things are counted on their own, not as finished;
  moving something back to Pending takes it out of the month it was finished in. The monthly and this-year numbers
  count from the day you updated to 3.0.0 (shown under the chart), so a library filled in all at once doesn't skew them.
  Episodes count when you see them: moving a series to Waiting counts the episodes out then, and finishing it
  counts the rest. They show in time spent and the year in review. Manga and comics are counted apart:
  a manga by its volumes, a comic as one book.

### Ratings

Moving something from Pending to Done is celebrated with confetti and a (hopefully) funny line.
Finished things can have a rating from 1 to 5 stars. It's optional: tap a star to rate,
and tap the same star again to clear it. Adding something straight to **Done** opens it, so
you can rate it right away. Moving an item back to Pending (or Waiting) clears its rating.

### Undo a mistake

Adding, moving, dropping or removing something shows a message with **Undo**: tap it to take that back. Moving something
from Done back to Pending says what that clears (its rating, the Dropped mark).

For anything older, tap **⋯** at the top right of the home screen, then **Recent activity** at the bottom: your latest 50 changes to items
(added, removed, moved, rated…), newest first. **Undo** puts the item back as it was before that change; a removed item
comes back with everything it had. An item's changes undo newest first, so only its latest one has the button.
Changes to settings aren't in it.

### Not in the search?

If the search doesn't find it, you can still add it by its title (**Add "…" anyway?**).
It gets a cover designed from its title, in its category's colors.

## Direct address and "Add to Home Screen"

Besides the sidebar, the add-on answers at `http://<homeassistant-ip>:3100/` on your home network.
Open that address in your phone's browser and use **Add to Home Screen** (iPhone: Share → Add to Home Screen)
to open the library like an app, full screen, with its own icon.
You can change the port, or turn it off, in the add-on's **Network** settings. The sidebar doesn't need it.

If the connection to Home Assistant is lost for more than a few seconds, a small **Offline** badge shows in the bottom
left corner until it's back. Changes can't be saved meanwhile.

The direct address has no login: anyone on your home network who knows it can open the library.
Turn it off if that's a concern; the sidebar and the Home Assistant app use your Home Assistant login.

## Install as an app on Android

Chrome on Android only installs an app from a secure (https) address with a trusted certificate. If Home Assistant
already has one for your own domain (e.g. Let's Encrypt, in its `ssl` folder), the add-on can use it:

1. In the add-on's **Configuration** tab, turn on **ssl**. `certfile` and `keyfile` are the certificate's files in the
   `ssl` folder (`fullchain.pem` and `privkey.pem` by default). Restart the add-on.
2. Make your domain point to Home Assistant's address on your home network, e.g. with a DNS rewrite in your router or
   AdGuard Home (`ha.example.com` → `192.168.1.10`).
3. On the phone, open `https://<your-domain>:3101/` in Chrome, then ⋮ → **Install app**.

Don't forward port 3101 on your router: there are no passwords, so keep it on your home network. The plain address on
port 3100 keeps working as before, and a renewed certificate is picked up by itself.

## Search and covers

Search works out of the box, with no account:

| Kind   | Searched on | Then, if nothing is found | With an API key (asked first) |
|--------|-------------|---------------------------|-------------------------------|
| Movies | Cinemeta (IMDb data) | — | TMDB |
| Series | TVmaze | Cinemeta | TMDB |
| Books  | Open Library | Apple Books | — |
| Manga/Comics: Manga | Kitsu (manga, manhwa, manhua) | MangaDex, then Open Library | — |
| Manga/Comics: Comics | Open Library (comics and graphic novels) | — | — |
| Games: PC | Steam | GOG | RAWG (every platform) |
| Games: Nintendo | Nintendo's store (Switch, 3DS, Wii U, Wii and the classics) | — | — |

For games, pick **PC** or **Nintendo** in the search field under the Game tab; each time you open the search it starts on PC.
For Manga/Comics, pick **Manga** or **Comics** the same way; it starts on Manga.
The next catalog is also asked when one doesn't answer, so search keeps working if a website is down.
The line under the results says which catalog found them.

An item's page also shows how long a movie is (e.g. 2h 35m), how many seasons and episodes of a series are out
(e.g. 3 seasons · 26 episodes), how many pages a book or a comic has (from Open Library; Apple Books doesn't say), and
how many volumes of a manga are out so far (from MangaUpdates).
They're looked up in the background after adding; a series or manga you haven't finished is checked again every
week, as new episodes and volumes come out.

The add-on needs internet access to search. When you add something, it saves a copy of the cover,
so the library keeps its pictures even if a website changes.

## Configuration

All options are optional. Leave the keys empty to use the catalogs above.

**tmdb_api_key** (optional)
- Searches movies and series on [TMDB](https://www.themoviedb.org/) first, which has the best posters and finds more
- Get a free key: create a TMDB account, then **Settings → API → Create**. Either the "API Key" or the
  longer "API Read Access Token" works.

**rawg_api_key** (optional)
- Searches games on [RAWG](https://rawg.io/) first, which knows console games too (Steam and GOG only have PC games)
- Get a free key at [rawg.io/apidocs](https://rawg.io/apidocs)

**ssl**, **certfile**, **keyfile** (optional)
- Also serve the app over https on port 3101, with Home Assistant's own certificate: see
  [Install as an app on Android](#install-as-an-app-on-android)

Restart the add-on after changing an option. Items you've already added keep their covers.

## Data

The library and its covers are saved in the add-on's data folder, so they survive restarts and updates.
They're included in Home Assistant backups.

## Support

For issues, please check the add-on logs in Home Assistant.
