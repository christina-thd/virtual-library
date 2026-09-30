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
  and done, and the newest covers. Tap a tile to open it; the back button (or ‹) returns home.
- In each kind, **Pending** is everything you haven't seen, read or played yet, or haven't finished.
  **Done** is everything you've finished. The newest are first. The tab you last used is remembered on each phone.
- Tap a cover to open it: move it between Pending and Done, rate it, or remove it.
- **+** searches the kind you're in (on the home screen, the kind you searched last).
- To close the search or an item, tap **Close** (or **Back to search**), swipe it down from the top, or use your phone's back button.
- After adding something, its search result says **✓ Added to Pending** (or Done); tap it to open the item.

### Ratings

Moving something from Pending to Done is celebrated with confetti and a (hopefully) funny line.
Finished things can have a rating from 1 to 5 stars. It's optional: tap a star to rate,
and tap the same star again to clear it. Adding something straight to **Done** opens it, so
you can rate it right away. Moving an item back to Pending clears its rating.

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

| Kind   | Searched on | With an API key |
|--------|-------------|-----------------|
| Movies | Cinemeta (IMDb data) | TMDB |
| Series | TVmaze | TMDB |
| Books  | Open Library | — |
| Games  | Steam (PC games) | RAWG (every platform) |

The add-on needs internet access to search. When you add something, it saves a copy of the cover,
so the library keeps its pictures even if a website changes.

## Configuration

Both options are optional. Leave them empty to use the catalogs above.

**tmdb_api_key** (optional)
- Searches movies and series on [TMDB](https://www.themoviedb.org/), which has the best posters and finds more
- Get a free key: create a TMDB account, then **Settings → API → Create**. Either the "API Key" or the
  longer "API Read Access Token" works.

**rawg_api_key** (optional)
- Searches games on [RAWG](https://rawg.io/), which knows console games too (Steam only has PC games)
- Get a free key at [rawg.io/apidocs](https://rawg.io/apidocs)

Restart the add-on after changing an option. Items you've already added keep their covers.

## Data

The library and its covers are saved in the add-on's data folder, so they survive restarts and updates.
They're included in Home Assistant backups.

## Support

For issues, please check the add-on logs in Home Assistant.
