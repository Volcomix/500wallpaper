const fs = require('fs')
const program = require('commander')
const axios = require('axios')

const { features, categories } = require('./constants')

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
      '  $ 500wallpaper -f editors -c Landscapes -H 2048 -l -o wallpaper',
    )
    console.log(
      '  $ 500wallpaper -f popular -c "City and Architecture,Landscapes,Nature,Travel" -H 4096 -l',
    )
  })

program.parse(process.argv)

const outFileName = program.output
const feature = program.feature || ''
const category = program.category || ''
const minWidth = program.width || 0
const minHeight = program.height || 0
const mustBeLandscape = program.landscape || false

const apiUrl = 'https://api.500px.com/v1/photos'

async function download() {
  try {
    const imageSize = Math.max(minWidth, minHeight) <= 2048 ? 2048 : 4096
    const url = `${apiUrl}?feature=${feature}&only=${category}&image_size[]=${imageSize}`
    console.log('Retrieving photos:', url)
    const apiResponse = await axios.get(url)
    const photo = apiResponse.data.photos.find(isWallpaper)
    const image = photo.images.find(image => image.size === imageSize)
    const displayName = getPhotoDisplayName(photo)
    console.log('Downloading:', displayName)
    const imageResponse = await axios.get(image.url, { responseType: 'stream' })
    const fileNameWithExt = `${outFileName || displayName}.${image.format}`
    const file = fs.createWriteStream(fileNameWithExt)
    imageResponse.data.pipe(file)
    console.log('Image saved:', fileNameWithExt)
  } catch (error) {
    console.error(error)
  }
}

function isWallpaper(photo) {
  if (
    (!mustBeLandscape || photo.width > photo.height) &&
    photo.width >= minWidth &&
    photo.height >= minHeight
  ) {
    return true
  } else {
    console.log('Skipping:', getPhotoDisplayName(photo))
    return false
  }
}

function getPhotoDisplayName(photo) {
  return photo.url.split('/').pop()
}

download()
