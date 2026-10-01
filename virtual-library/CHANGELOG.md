# Changelog

## Unreleased
- Search asks a second catalog when the first finds nothing or is down: Cinemeta for series, Apple Books for books,
  GOG for games (no account needed). With an API key, TMDB / RAWG go first and the free ones stay as fallbacks
- Nintendo games: pick PC or Nintendo when searching games (Switch, 3DS, Wii U, Wii and the classics, with box art)
- Series have a third tab, **Waiting**, for series you've caught up on that are waiting for a new season
- Categories always open on Pending, and the title and back button stay at the top with the tabs while scrolling
- Sort a shelf by recent, name (A–Z) or rating, with the button next to Pending / Done; Pending always starts newest first, Done best rated first
- Home screen tiles show random covers from each category (new ones each time you come back to the home screen), not only the newest
- Anything can be added as typed, also when there are results: "Not in the list?" below them
- Faster search: recent searches come back instantly, and slow Steam cover lookups no longer hold up game results
- Messages ("added to Done", "Removed", errors) show at the top of the screen, so they never cover the rating stars;
  the "Added to …" badge on the item is gone, and rating something confirms it ("Rated … 4 of 5")
- No more zooming in on iPhone when tapping a button twice quickly (e.g. "Tap again to remove")

## 1.0.6
- **+** inside a category only adds to that category ("Add a game"), so nothing lands somewhere you're not looking
- **+** on the home screen still lets you pick the category

## 1.0.5
- Fix no cover UI

## 1.0.4
- Finishing something (Pending → Done) is celebrated: confetti and a funny line for movies, series, books or games
- The item page no longer shows the "Finished on" / "Added on" date

## 1.0.3
- Clearer when something is added: its search result shows "✓ Added to Pending" (or Done), with a confirmation message
- Adding as Done opens the item with "Added to Done" and a "Back to search" button, instead of an unlabelled ✕
- The item page's close button now says Close
- Items without a picture get a designed cover in their category's colors, with the title, instead of a plain placeholder

## 1.0.2
- Fix: the back button (‹) at the top of a category didn't respond on iPhones with a notch

## 1.0.1
- Fix: opening the search on a phone no longer pushes the screen down when the keyboard appears
- Close button moved to the top of the search, next to a title

## 1.0.0
- First release as a Home Assistant add-on
- Movies, series, books and games, each with its cover
- Search without an account: Cinemeta, TVmaze, Open Library and Steam; optional TMDB and RAWG keys
- Home screen with a tile per kind; Pending and Done lists in each, optional 5-star rating
- Covers saved in the add-on
- Dark design for phones in portrait; sidebar, Home Assistant app and "Add to Home Screen"
