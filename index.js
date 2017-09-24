const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)
const writeFile = util.promisify(require('fs').writeFile)
const { execFile } = require('child_process')
const CDP = require('chrome-remote-interface')

async function main() {
  let chrome
  let client
  try {
    console.log('Starting Chrome...')
    chrome = execFile('google-chrome-stable', [
      '--headless',
      '--remote-debugging-port=9222',
    ])
    client = await getClient()
    console.log('Chrome started.')

    new Downloader(client).download('wallpaper.png')

  } catch (error) {
    console.error(error)
  } finally {
    console.log('Closing Chrome...')
    /*if (client) {
      await client.close()
    }
    if (chrome) {
      chrome.kill()
    }*/
    console.log('Chrome closed.')
  }
}

async function getClient(maxRetry = 10, retry = 0) {
  try {
    console.log(`Waiting for client... (${retry}/${maxRetry})`)
    return await CDP()
  } catch (error) {
    if (retry === maxRetry) {
      throw new Error('Could not start Chrome!')
    }
    await setTimeoutPromise(500)
    return getClient(maxRetry, retry + 1)
  }
}

class Downloader {
  static get defaultUrl() {
    return 'https://500px.com/editors/landscapes'
  }

  static get defaultOptions() {
    return {
      imageSize: 2048,
      minPulse: 99,
    }
  }

  static get apiRequestPattern() {
    return /^https:\/\/api.500px.com\/v1\/photos/
  }

  constructor(client, options = {}) {
    this.client = client

    const { imageSize, minPulse } = { ...Downloader.defaultOptions, options }
    this.imageSize = imageSize
    this.minPulse = minPulse

    this.requestUrls = {}
    this.requestIds = {}
    this.apiRequestUrl
    this.apiRequestId
    this.imageRequestId

    this.destFile
  }

  async download(destFile, url = Downloader.defaultUrl) {
    const { Network, Page } = this.client

    this.destFile = destFile

    Network.requestIntercepted(this.requestIntercepted.bind(this))
    Network.requestWillBeSent(this.requestWillBeSent.bind(this))
    Network.loadingFinished(this.loadingFinished.bind(this))

    await Network.enable()
    await Page.enable()

    await Network.setRequestInterceptionEnabled({ enabled: true })

    console.log(`Navigating to ${url}...`)
    Page.navigate({ url })
  }

  requestIntercepted({ interceptionId, request }) {
    const { Network } = this.client
    let { url } = request
    if (!this.apiRequestUrl && this.isApiRequest(request)) {
      console.log()
      console.log(`API request intercepted:`)
      console.log(url)
      console.log()
      this.apiRequestUrl = url
      url = this.modifyApiRequest(url)
      console.log(`API request modified:`)
      console.log(url)
      console.log()
      console.log('Waiting for API request...')
    }
    Network.continueInterceptedRequest({ interceptionId, url })
  }

  requestWillBeSent({ requestId, request }) {
    const { method, url } = request
    if (method === 'GET') {
      this.requestUrls[url] = requestId
      this.requestIds[requestId] = false
      if (url === this.apiRequestUrl) {
        this.apiRequestId = requestId
      }
    }
  }

  loadingFinished({ requestId }) {
    if (this.requestIds[requestId] === undefined) {
      return
    }
    this.requestIds[requestId] = true
    if (requestId === this.apiRequestId) {
      this.apiRequestFinished(requestId)
    } else if (requestId === this.imageRequestId) {
      this.imageRequestFinished(requestId)
    }
  }

  async apiRequestFinished(requestId) {
    const { Network } = this.client
    console.log('API request finished.')
    const response = await Network.getResponseBody({ requestId })
    const { photos } = JSON.parse(response.body)
    const photo = photos.find(photo => this.shouldSavePhoto(photo))
    console.log()
    console.log('Image found:')
    console.log({
      name: photo.name,
      author: {
        firstname: photo.user.firstname,
        lastname: photo.user.lastname,
      },
      image_url: photo.image_url,
    })
    console.log()
    this.saveImage(photo.image_url)
  }

  saveImage(url) {
    this.imageRequestId = this.requestUrls[url]
    const isImageRequestFinished = this.requestIds[this.imageRequestId]
    if (isImageRequestFinished) {
      this.imageRequestFinished()
    } else if (isImageRequestFinished === undefined) {
      this.downloadImage(url)
    } else {
      console.log('Waiting for image request...')
    }
  }

  downloadImage(url) {
    console.log('Downloading image...')
  }

  async imageRequestFinished() {
    const { Network } = this.client
    console.log('Image request finished.')
    const { body } = await Network.getResponseBody({
      requestId: this.imageRequestId,
    })
    console.log('Saving image...')
    const imageData = await this.convertImage(body)
    const buffer = Buffer.from(imageData, 'base64')
    await writeFile(this.destFile, buffer)
    console.log(`Image saved: ${this.destFile}`)
  }

  async convertImage(imageData) {
    const { Runtime } = this.client
    const result = await Runtime.evaluate({
      expression: `
        new Promise(function (resolve) {
          const image = new Image
          image.onload = function() {
            var canvas = document.createElement('canvas')
            canvas.width = this.naturalWidth
            canvas.height = this.naturalHeight
            canvas.getContext('2d').drawImage(this, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          }
          image.src = 'data:;base64,${imageData}'
        })
      `,
      awaitPromise: true,
    })
    return result.result.value.replace(/^data:image\/(png|jpg);base64,/, '')
  }

  isApiRequest({ method, url }) {
    return method === 'GET' && Downloader.apiRequestPattern.test(url)
  }

  modifyApiRequest(url) {
    const pattern = `&image_size%5B%5D=(?!${this.imageSize})\\d*`
    return url
      .replace(new RegExp(pattern, 'g'), '')
      .replace(/&image_size%5B%5D=/g, '&image_size=')
  }

  shouldSavePhoto(photo) {
    return photo.width > photo.height
      && photo.width >= this.imageSize
      && photo.highest_rating > this.minPulse
  }
}

main()