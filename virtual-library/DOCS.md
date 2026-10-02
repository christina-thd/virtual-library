# Hoard Board Add-on Documentation

Hoard Board keeps a personal library of movies, series, books and games: what you've finished,
and what's still pending.

## Usage

1. Install and start the add-on, and turn on **Show in sidebar**
2. Open **Hoard Board** in the Home Assistant sidebar. On your phone, use the Home Assistant app
   (it's in the app's sidebar too).
3. Tap **+**, pick Movie, Series, Book or Game, and type a title
4. Tap **Pending** or **Done** next to the right result

### The library

- The home screen has one tile per kind (Movies, Series, Books, Games), with how many are pending
  and done, and a few random covers. Tap a tile to open it; the back button (or ‹) returns home.
- In each kind, **Pending** is everything you haven't seen, read or played yet, or haven't finished.
  **Done** is everything you've finished. Each kind opens on Pending, newest first; Done starts with your best rated.
  Use the sort button next to the tabs for A–Z, rating (on Done) or length: a movie's duration, a series' seasons,
  a book's pages, or the hours you played a game (on Done).
- **Series** have a third tab, **Waiting**: series you've caught up on, waiting for a new season. Move a series there
  from its page; when the new season is out, move it back to Pending.
- Tap a cover to open it: move it between Pending, (Waiting) and Done, rate it, or remove it. A finished game also
  has a **Playtime** field, if you want to keep track.
- Gave up on something because it wasn't worth finishing? Tap **Dropped it** on its page. It goes to Done (no confetti),
  greyed out with a red **Dropped** band across its cover. Tap it again to undo, or move it back to Pending.
- **+** inside a kind adds to that kind only (e.g. "Add a game"). **+** on the home screen lets you pick the kind
  (it starts on the one you picked last).
- To close the search or an item, tap **Close** (or **Back to search**), swipe it down from the top, or use your phone's back button.
- After adding something, its search result says **✓ Added to Pending** (or Done); tap it to open the item.
- **Stats** (the chart button at the top of the home screen): what you finished each month over the last year,
  your top genres, time spent (hours of movies, episodes, pages, playtime), ratings, and the oldest thing
  still pending. For the whole library or one kind. Dropped things are counted on their own, not as finished;
  moving something back to Pending takes it out of the month it was finished in. The monthly and this-year numbers
  count from the day you updated to 3.0.0 (shown under the chart), so a library filled in all at once doesn't skew them.

### Ratings

Moving something from Pending to Done is celebrated with confetti and a (hopefully) funny line.
Finished things can have a rating from 1 to 5 stars. It's optional: tap a star to rate,
and tap the same star again to clear it. Adding something straight to **Done** opens it, so
you can rate it right away. Moving an item back to Pending (or Waiting) clears its rating.

### Not in the search?

If the search doesn't find it, you can still add it by its title (**Add "…" anyway?**).
It gets a cover designed from its title, in its category's colors.

## Direct address and "Add to Home Screen"

Besides the sidebar, the add-on answers at `http://<homeassistant-ip>:3100/` on your home network.
Open that address in your phone's browser and use **Add to Home Screen** (iPhone: Share → Add to Home Screen)
to open the library like an app, full screen, with its own icon.
You can change the port, or turn it off, in the add-on's **Network** settings. The sidebar doesn't need it.

The direct address has no login: anyone on your home network who knows it can open the library.
Turn it off if that's a concern; the sidebar and the Home Assistant app use your Home Assistant login.

## Search and covers

Search works out of the box, with no account:

| Kind   | Searched on | Then, if nothing is found | With an API key (asked first) |
|--------|-------------|---------------------------|-------------------------------|
| Movies | Cinemeta (IMDb data) | — | TMDB |
| Series | TVmaze | Cinemeta | TMDB |
| Books  | Open Library | Apple Books | — |
| Games: PC | Steam | GOG | RAWG (every platform) |
| Games: Nintendo | Nintendo's store (Switch, 3DS, Wii U, Wii and the classics) | — | — |

For games, pick **PC** or **Nintendo** in the search field under the Game tab; each time you open the search it starts on PC.
The next catalog is also asked when one doesn't answer, so search keeps working if a website is down.
The line under the results says which catalog found them.

An item's page also shows how long a movie is (e.g. 2h 35m), how many seasons and episodes of a series are out
(e.g. 3 seasons · 26 episodes), and how many pages a book has (from Open Library; Apple Books doesn't say).
They're looked up in the background after adding; a series you haven't finished is checked again every week,
as new episodes come out.

The add-on needs internet access to search. When you add something, it saves a copy of the cover,
so the library keeps its pictures even if a website changes.

## Configuration

Both options are optional. Leave them empty to use the catalogs above.

**tmdb_api_key** (optional)
- Searches movies and series on [TMDB](https://www.themoviedb.org/) first, which has the best posters and finds more
- Get a free key: create a TMDB account, then **Settings → API → Create**. Either the "API Key" or the
  longer "API Read Access Token" works.

**rawg_api_key** (optional)
- Searches games on [RAWG](https://rawg.io/) first, which knows console games too (Steam and GOG only have PC games)
- Get a free key at [rawg.io/apidocs](https://rawg.io/apidocs)

Restart the add-on after changing an option. Items you've already added keep their covers.

## Data

The library and its covers are saved in the add-on's data folder, so they survive restarts and updates.
They're included in Home Assistant backups.

## Support

For issues, please check the add-on logs in Home Assistant.
