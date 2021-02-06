#!/usr/bin/env node

const program = require('commander')

const package = require('./package')
const { features, categories } = require('./constants')
const Wallpaper = require('./wallpaper')

program
  .version(package.version)
  .option('-f, --feature <featureName>', 'photo stream to be retrieved')
  .option(
    '-c, --category <categoryName>',
    'category to return photos from (case sensitive, separate multiple values with a comma)',
  )
  .option(
    '-w, --width <minWidth>',
    'minimum width of the photo to be downloaded',
  )
  .option(
    '-H, --height <minHeight>',
    'minimum height of the photo to be downloaded',
  )
  .option('-l, --landscape', 'the photo must be in landscape orientation')
  .option('-o, --output <fileName>', 'destination file name without extension')
  .addHelpText(
    'after',
    `
Features:
  ${features.join(', ')}

Categories:
  ${categories.join(', ')}

Examples:
  $ ${package.name}
  $ ${package.name} -o wallpaper
  $ ${package.name} ${[
      '-f editors',
      '-c Landscapes',
      '-H 2048',
      '-l',
      '-o ~/Images/wallpaper',
    ].join(' ')}
  $ ${package.name} ${[
      '-f popular',
      '-c "City and Architecture,Landscapes,Nature,Travel"',
      '-H 4096',
      '-l',
    ].join(' ')}`,
  )

program.parse(process.argv)
const options = program.opts()

new Wallpaper({
  outFileName: options.output,
  feature: options.feature,
  category: options.category,
  minWidth: options.width,
  minHeight: options.height,
  mustBeLandscape: options.landscape,
}).findAndDownload()
