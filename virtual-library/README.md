# Hoard Board Add-on

A personal library of movies, series, books and games. Search for something, add it as
**Pending** or **Done**, and rate what you've finished.

## Features

- Movies, series, books and games in one place, each with its cover
- Search built in: no account or API key needed
- Two lists: **Pending** and **Done** (series also **Waiting**, for a new season)
- Optional 5-star rating for finished things

## Installation

1. Add this repository to Home Assistant, or copy this directory to your Home Assistant `/addons` folder
2. Refresh the add-on store
3. Install the "Hoard Board" add-on
4. Start it, and turn on "Show in sidebar"

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| tmdb_api_key | password | (empty) | Optional. Search movies and series on TMDB |
| rawg_api_key | password | (empty) | Optional. Search games on RAWG (every platform, not only PC) |

## Usage

Open **Hoard Board** in the Home Assistant sidebar
or go straight to `http://<your-homeassistant-ip>:3100/`.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
