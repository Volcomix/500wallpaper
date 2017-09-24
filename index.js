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
    chrome = startChrome()
    client = await getClient()
    console.log('Client connected.')
    const downloader = new Downloader(client)
    await downloader.download(
      'wallpaper.png',
      'https://500px.com/editors/landscapes'
    )
    await downloader.download(
      'lockscreen.png',
      'https://500px.com/popular/landscapes'
    )
  } catch (error) {
    console.error(error)
  } finally {
    if (client) {
      console.log('Closing client...')
      await client.close()
      console.log('Client closed.')
    }
    if (chrome) {
      console.log('Stopping Chrome...')
      chrome.kill()
      console.log('Chrome stopped.')
    }
  }
}

function startChrome() {
  return execFile('google-chrome-stable', [
    '--headless',
    '--remote-debugging-port=9222',
  ])
}

async function getClient(maxRetry = 10, retry = 0) {
  try {
    console.log(`Trying to connect client... (${retry}/${maxRetry})`)
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
  }

  async init() {
    const { Network, Page } = this.client

    console.log('Configuring client...')

    Network.requestIntercepted(this.requestIntercepted.bind(this))
    Network.requestWillBeSent(this.requestWillBeSent.bind(this))
    Network.loadingFinished(this.loadingFinished.bind(this))

    await Network.enable()
    await Page.enable()

    await Network.setRequestInterceptionEnabled({ enabled: true })

    console.log('Client configured.')

    this.isInitialized = true
  }

  async download(destFile, url = Downloader.defaultUrl) {
    const { Network, Page } = this.client

    this.requestUrls = {}
    this.requestIds = {}
    this.apiRequestUrl = undefined
    this.apiRequestId = undefined
    this.imageRequestId = undefined

    this.destFile = destFile

    if (!this.isInitialized) {
      await this.init()
    }

    console.log(`Navigating to ${url}...`)
    await Page.navigate({ url })
    await Page.loadEventFired()

    await new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  async requestIntercepted({ interceptionId, request }) {
    try {
      const { Network } = this.client
      let { url } = request
      if (!this.apiRequestUrl && this.isApiRequest(request)) {
        console.log(`\nAPI request intercepted:\n${url}`)
        this.apiRequestUrl = url
        url = this.modifyApiRequest(url)
        console.log(`\nAPI request modified:\n${url}\n`)
        console.log('Waiting for API request...')
      }
      await Network.continueInterceptedRequest({ interceptionId, url })
    } catch (error) {
      this.reject(error)
    }
  }

  requestWillBeSent({ requestId, request }) {
    try {
      const { method, url } = request
      if (method === 'GET') {
        this.requestUrls[url] = requestId
        this.requestIds[requestId] = false
        if (url === this.apiRequestUrl) {
          this.apiRequestId = requestId
        }
      }
    } catch (error) {
      this.reject(error)
    }
  }

  async loadingFinished({ requestId }) {
    try {
      if (this.requestIds[requestId] === undefined) {
        return
      }
      this.requestIds[requestId] = true
      if (requestId === this.apiRequestId) {
        await this.apiRequestFinished(requestId)
      } else if (requestId === this.imageRequestId) {
        await this.imageRequestFinished(requestId)
      }
    } catch (error) {
      this.reject(error)
    }
  }

  async apiRequestFinished(requestId) {
    const { Network } = this.client
    console.log('API request finished.')
    const response = await Network.getResponseBody({ requestId })
    const { photos } = JSON.parse(response.body)
    const photo = photos.find(photo => this.shouldSavePhoto(photo))
    console.log('\nImage found:')
    console.log({
      name: photo.name,
      author: {
        firstname: photo.user.firstname,
        lastname: photo.user.lastname,
      },
      image_url: photo.image_url,
    })
    console.log()
    await this.saveImage(photo.image_url)
  }

  async saveImage(url) {
    this.imageRequestId = this.requestUrls[url]
    const isImageRequestFinished = this.requestIds[this.imageRequestId]
    if (isImageRequestFinished) {
      await this.imageRequestFinished()
    } else if (isImageRequestFinished === undefined) {
      await this.downloadImage(url)
    } else {
      console.log('Waiting for image request...')
    }
  }

  async downloadImage(url) {
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
    this.resolve()
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