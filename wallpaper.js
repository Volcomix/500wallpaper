const fs = require('fs')
const axios = require('axios')

const apiUrl = 'https://api.500px.com/v1/photos'

class Wallpaper {
  constructor(options = {}) {
    this.outFileName = options.outFileName
    this.feature = options.feature || ''
    this.category = options.category || ''
    this.minWidth = options.minWidth || 0
    this.minHeight = options.minHeight || 0
    this.mustBeLandscape = options.mustBeLandscape || false

    const maxEdgeLength = Math.max(this.minWidth, this.minHeight)
    this.imageSize = maxEdgeLength <= 2048 ? 2048 : 4096
  }

  async findAndDownload() {
    try {
      const photos = await this.retrievePhotos()
      const photo = this.findWallpaper(photos)
      await this.download(photo)
    } catch (error) {
      console.error(error)
    }
  }

  async retrievePhotos() {
    console.log('Retrieving photos')

    const response = await axios.get(apiUrl, {
      params: {
        feature: this.feature,
        only: this.category,
        image_size: [this.imageSize],
      },
    })
    const photos = response.data.photos

    console.log(
      `${photos.length} photos retrieved from:`,
      response.request.path,
    )

    return photos
  }

  findWallpaper(photos) {
    return photos.find(photo => this.isWallpaper(photo))
  }

  async download(photo) {
    const displayName = this.getPhotoDisplayName(photo)
    const image = photo.images.find(image => image.size === this.imageSize)
    const fileNameWithExt = `${this.outFileName || displayName}.${image.format}`

    console.log('Downloading:', displayName)

    const response = await axios.get(image.url, { responseType: 'stream' })
    const file = fs.createWriteStream(fileNameWithExt)
    response.data.pipe(file)

    console.log('Image saved:', fileNameWithExt)
  }

  isWallpaper(photo) {
    if (
      (!this.mustBeLandscape || photo.width > photo.height) &&
      photo.width >= this.minWidth &&
      photo.height >= this.minHeight
    ) {
      return true
    } else {
      console.log('Skipping:', this.getPhotoDisplayName(photo))
      return false
    }
  }

  getPhotoDisplayName(photo) {
    return photo.url.split('/').pop()
  }
}

module.exports = Wallpaper
