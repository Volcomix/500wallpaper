# 500wallpaper

[![dependencies Status](https://david-dm.org/volcomix/500wallpaper/status.svg)](https://david-dm.org/volcomix/500wallpaper)
[![devDependencies Status](https://david-dm.org/volcomix/500wallpaper/dev-status.svg)](https://david-dm.org/volcomix/500wallpaper?type=dev)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=Volcomix/500wallpaper)](https://dependabot.com)
[![License](https://img.shields.io/github/license/volcomix/500wallpaper)](LICENSE)

Download wallpapers and lock screens from [500px](https://500px.com) website.

<p align="center">
  <img width="600" src="screencast.svg?sanitize=true">
</p>

## Installation

```bash
npm install -g 500wallpaper
# OR
yarn global add 500wallpaper
```

Alternatively, you can also invoke the binary directly with [npx](https://www.npmjs.com/package/npx):

```bash
npx 500wallpaper
```

## Usage

Run `500wallpaper` without argument to download the recently added photo with the highest Pulse from [500px](https://500px.com).

View the list of options using `500wallpaper --help`:

```
Usage: 500wallpaper [options]

Options:
  -V, --version                  output the version number
  -f, --feature <featureName>    photo stream to be retrieved
  -c, --category <categoryName>  category to return photos from (case sensitive, separate multiple values with a comma)
  -w, --width <minWidth>         minimum width of the photo to be downloaded
  -H, --height <minHeight>       minimum height of the photo to be downloaded
  -l, --landscape                the photo must be in landscape orientation
  -o, --output <fileName>        destination file name without extension
  -h, --help                     output usage information

Features:
  popular, highest_rated, upcoming, editors, fresh_today, fresh_yesterday, fresh_week

Categories:
  Uncategorized, Abstract, Aerial, Animals, Black and White, Celebrities, City and Architecture, Commercial, Concert, Family, Fashion, Film, Fine Art, Food, Journalism, Landscapes, Macro, Nature, Night, Nude, People, Performing Arts, Sport, Still Life, Street, Transportation, Travel, Underwater, Urban Exploration, Wedding

Examples:
  $ 500wallpaper
  $ 500wallpaper -o wallpaper
  $ 500wallpaper -f editors -c Landscapes -H 2048 -l -o ~/Images/wallpaper
  $ 500wallpaper -f popular -c "City and Architecture,Landscapes,Nature,Travel" -H 4096 -l
```

## License

This project is licensed under the terms of the
[MIT license](LICENSE).
