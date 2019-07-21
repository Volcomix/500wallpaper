const fs = require('fs')
const axios = require('axios')

const destinationFileName = 'wallpaper'
const feature = 'popular'
const category = ''
const minWidth = 2048
const minHeight = 2048
const mustBeLandscape = true

const apiUrl = 'https://api.500px.com/v1/photos'

async function download() {
  try {
    const imageSize = Math.max(minWidth, minHeight) <= 2048 ? 2048 : 4096
    const url = `${apiUrl}?feature=${feature}&only=${category}&image_size[]=${imageSize}`
    const apiResponse = await axios.get(url)
    const photo = apiResponse.data.photos.find(isWallpaper)
    const image = photo.images.find(image => image.size === imageSize)
    const imageResponse = await axios.get(image.url, { responseType: 'stream' })
    const file = fs.createWriteStream(`${destinationFileName}.${image.format}`)
    imageResponse.data.pipe(file)
    console.log('Downloading:', getPhotoDisplayName(photo))
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
