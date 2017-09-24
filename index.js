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

    const downloader = new Downloader(client)
    downloader.download()

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
  constructor(client, options = {}) {
    this.client = client

    const {
      imageSize = 2048,
      minPulse = 99,
    } = options
    this.imageSize = imageSize
    this.minPulse = minPulse

    this.requestUrls = {}
    this.requestIds = {}
    this.apiRequestUrl
    this.apiRequestId
    this.imageRequestId
  }

  async download(url = 'https://500px.com/editors/landscapes') {
    const { Network, Page } = this.client

    Network.requestIntercepted(this.requestIntercepted.bind(this))
    Network.requestWillBeSent(this.requestWillBeSent.bind(this))
    Network.loadingFinished(this.loadingFinished.bind(this))

    await Network.enable()
    await Page.enable()

    await Network.setRequestInterceptionEnabled({ enabled: true })

    console.log('Navigating to 500px.com...')
    await Page.navigate({ url })
  }

  requestIntercepted({ interceptionId, request }) {
    const { Network } = this.client
    let { url } = request
    if (!this.apiRequestUrl && this.isApiRequest(request)) {
      console.log(`API request intercepted: ${url}`)
      this.apiRequestUrl = url
      url = this.modifyApiRequest(url)
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

    console.log(photo)
  }

  imageRequestFinished(requestId) {
    console.log('Image request finished.')
  }

  isApiRequest({ method, url }) {
    return method === 'GET' && Downloader.apiRequestPattern.test(url)
  }

  modifyApiRequest(url) {
    const pattern = `&image_size%5B%5D=(?!${this.imageSize})\d*`
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

Downloader.apiRequestPattern = /^https:\/\/api.500px.com\/v1\/photos/

async function download({ Network, Page, Runtime }) {
  const requestsUrls = {}
  const requestsIds = {}
  let interceptedUrl
  let interceptedRequestId
  let imageRequestId

  Network.requestIntercepted(({ interceptionId, request }) => {
    let { method, url } = request

    if (!interceptedUrl && method === 'GET' && url.startsWith('https://api.500px.com/v1/photos')) {
      console.log(`API request intercepted: ${url}`)
      interceptedUrl = url

      url = url
        .replace(/&image_size%5B%5D=(?!2048)\d*/g, '')
        .replace(/&image_size%5B%5D=/g, '&image_size=')

      console.log('Waiting for API request...')
    }

    Network.continueInterceptedRequest({ interceptionId, url })
  })

  Network.requestWillBeSent(({ requestId, request }) => {
    const { method, url } = request
    if (method === 'GET') {
      requestsUrls[url] = requestId
      requestsIds[requestId] = false
      if (url === interceptedUrl) {
        interceptedRequestId = requestId
      }
    }
  })

  const loadImage = new Promise((resolve, reject) => {
    Network.loadingFinished(async ({ requestId }) => {
      requestsIds[requestId] = true
      if (requestId === interceptedRequestId) {
        console.log('API request done.')
        const response = await Network.getResponseBody({ requestId })
        const body = JSON.parse(response.body)
        const { photos } = body
        const photo = photos.find(photo => photo.width > photo.height && photo.width >= 2048 && photo.highest_rating > 99)

        console.log(photo)

        console.log(`Image URL: ${photo.image_url}`)

        imageRequestId = requestsUrls[photo.image_url]
        const alreadyLoaded = requestsIds[imageRequestId]
        console.log(`Image already loaded: ${alreadyLoaded}`)

        if (alreadyLoaded) {
        } else if (alreadyLoaded === false) {
          console.log('Waiting for image loading...')
        } else {
          console.log('Loading image...')
        }
      } else if (requestId === imageRequestId) {
        console.log('Image loaded.')
        const response = await Network.getResponseBody({ requestId })
        console.log('Saving image...')
        let imageData
        if (response.base64Encoded) {
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
                image.src = 'data:;base64,${response.body}'
              })
            `,
            awaitPromise: true,
          })
          imageData = result.result.value.replace(/^data:image\/(png|jpg);base64,/, '')
          imageData = Buffer.from(imageData, 'base64')
        } else {
          imageData = response.body
        }
        await writeFile('wallpaper.png', imageData)

        console.log('Image saved.')

        resolve()
      }
    })
  })

  await Network.enable()
  await Page.enable()

  await Network.setRequestInterceptionEnabled({ enabled: true })

  console.log('Navigating to 500px.com...')
  await Page.navigate({ url: 'https://500px.com/editors/landscapes' })

  await loadImage
}

main()