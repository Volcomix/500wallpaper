const https = require('https')
const fs = require('fs')
const puppeteer = require('puppeteer')

const paths = {
  wallpaper: 'popular/landscapes',
  lockscreen: 'editors/landscapes',
}
const minWidth = 1900
const minHeight = 800
const mustBeLandscape = true

const largeViewport = { width: 1888, height: 800 }
const baseUrl = 'https://500px.com'
const maxPhotoNavigations = 50
const preloadedImageHeight = 300
const selectors = {
  photoThumbnail: '.photo_thumbnail',
  photo: '.photo-show__img',
  photoNavigation: '[class^=Elements__PhotoNavigationWrapper]',
}

async function main() {
  const browser = await puppeteer.launch({ defaultViewport: largeViewport })
  try {
    const page = await browser.newPage()
    const explorer = new Explorer(page)
    for (const destinationFileName in paths) {
      const imagesPath = paths[destinationFileName]
      await explorer.findAndDownload(imagesPath, destinationFileName)
    }
  } catch (error) {
    console.error(error)
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
    const photo = await this.findPhoto()
    this.download(photo, destinationFileName)
  }

  async openFirstPhoto() {
    await this.page.waitForSelector(selectors.photoThumbnail)
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(selectors.photoThumbnail),
    ])
  }

  async findPhoto() {
    for (let i = 0; i < maxPhotoNavigations; i++) {
      await this.waitForImageLoading()
      const { width, height, src } = await this.getImageInfos()
      if (this.shouldPickPhoto(width, height)) {
        return { url: this.page.url(), imageSrc: src }
      } else {
        console.log('Skipping:', this.page.url())
      }
      await this.goToNextPhoto()
    }
    throw new Error(
      `No suitable photo found in ${maxPhotoNavigations} navigations`,
    )
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

  download(photo, destinationFileName) {
    const file = fs.createWriteStream(`${destinationFileName}.jpg`)
    https.get(photo.imageSrc, response => response.pipe(file))
    console.log(`Downloading ${destinationFileName}: ${photo.url}`)
  }
}

main()
