#!/usr/bin/env node

const program = require('commander')

const { features, categories } = require('./constants')
const Wallpaper = require('./wallpaper')

program
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
  .on('--help', () => {
    console.log('')
    console.log('Features:')
    console.log(' ', features.join(', '))
    console.log('')
    console.log('Categories:')
    console.log(' ', categories.join(', '))
    console.log('')
    console.log('Examples:')
    console.log('  $ 500wallpaper')
    console.log('  $ 500wallpaper -o wallpaper')
    console.log(
      '  $ 500wallpaper -f editors -c Landscapes -H 2048 -l -o ~/Images/wallpaper',
    )
    console.log(
      '  $ 500wallpaper -f popular -c "City and Architecture,Landscapes,Nature,Travel" -H 4096 -l',
    )
  })

program.parse(process.argv)

new Wallpaper({
  outFileName: program.output,
  feature: program.feature,
  category: program.category,
  minWidth: program.width,
  minHeight: program.height,
  mustBeLandscape: program.landscape,
}).findAndDownload()
