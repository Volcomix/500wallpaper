const https = require('https')
const fs = require('fs')
const puppeteer = require('puppeteer')

const paths = {
  wallpaper: 'popular/landscapes',
  lockscreen: 'editors/landscapes',
}
const imagesToPick = 1
const minWidth = 1900
const minHeight = 800
const mustBeLandscape = true

const largeViewport = { width: 1888, height: 800 }
const baseUrl = 'https://500px.com'
const preloadedImageHeight = 300
const selectors = {
  photoThumbnail: '.photo_thumbnail',
  photo: '.photo-show__img',
  photoNavigation: '[class^=Elements__PhotoNavigationWrapper]',
}

async function main() {
  const browser = await puppeteer.launch({ defaultViewport: largeViewport })
  const page = await browser.newPage()
  const explorer = new Explorer(page)
  for (const destinationFileName in paths) {
    const imagesPath = paths[destinationFileName]
    await explorer.findAndDownload(imagesPath, destinationFileName)
  }
  await browser.close()
}

class Explorer {
  /**
   * @param {puppeteer.Page} page
   */
  constructor(page) {
    this.page = page
  }

  async findAndDownload(imagesPath, destinationFileName) {
    console.log('Navigating to:', imagesPath)
    await this.page.goto(`${baseUrl}/${imagesPath}`)
    await this.openFirstPhoto()
    const images = await this.filterPhotos()
    const image = this.chooseRandomOne(images)
    this.download(image, destinationFileName)
  }

  async openFirstPhoto() {
    await this.page.waitForSelector(selectors.photoThumbnail)
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(selectors.photoThumbnail),
    ])
  }

  async filterPhotos() {
    const images = []
    while (images.length < imagesToPick) {
      await this.waitForImageLoading()
      const { width, height, src } = await this.getImageInfos()
      if (this.shouldPickPhoto(width, height)) {
        console.log('Picking:', this.page.url())
        images.push({ url: this.page.url(), src: src })
      } else {
        console.log('Skipping:', this.page.url())
      }
      if (images.length < imagesToPick) {
        await this.goToNextPhoto()
      }
    }
    return images
  }

  async waitForImageLoading() {
    await this.page.waitFor(
      (selector, preloadedImageHeight) => {
        const { naturalHeight } = document.querySelector(selector)
        return naturalHeight > preloadedImageHeight
      },
      {},
      selectors.photo,
      preloadedImageHeight,
    )
  }

  async getImageInfos() {
    return await this.page.$eval(selectors.photo, img => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      src: img.src,
    }))
  }

  shouldPickPhoto(width, height) {
    return (
      (!mustBeLandscape || width > height) &&
      width >= minWidth &&
      height >= minHeight
    )
  }

  async goToNextPhoto() {
    const nextPhotoNavigation = await this.getNextPhotoNavigation()
    await Promise.all([
      this.page.waitForNavigation(),
      nextPhotoNavigation.click(),
    ])
  }

  async getNextPhotoNavigation() {
    const navigation = await this.page.$$(selectors.photoNavigation)
    return navigation.pop()
  }

  chooseRandomOne(images) {
    if (images.length === 1) {
      return images[0]
    } else {
      const random = Math.floor(Math.random() * images.length)
      console.log('Choosing:', random)
      return images[random]
    }
  }

  download(image, destinationFileName) {
    const file = fs.createWriteStream(`${destinationFileName}.jpg`)
    https.get(image.src, response => response.pipe(file))
    console.log(`Downloading ${destinationFileName}: ${image.url}`)
  }
}

main()
