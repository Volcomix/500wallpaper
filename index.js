const https = require('https')
const fs = require('fs')
const puppeteer = require('puppeteer')

const paths = {
  wallpaper: 'search?q=patagonia&type=photos&sort=pulse',
  lockscreen: 'search?q=snowcapped&type=photos&sort=pulse',
}

;(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1888, height: 800 },
  })
  const page = await browser.newPage()
  for (const fileName in paths) {
    const path = paths[fileName]
    console.log('Navigating to:', path)
    await page.goto(`https://500px.com/${path}`)
    await page.waitForSelector('.photo_thumbnail')
    await Promise.all([
      page.waitForNavigation(),
      page.click('.photo_thumbnail'),
    ])
    for (let i = 0; i < 50; i++) {
      await page.waitFor(() => {
        const img = document.querySelector('.photo-show__img')
        return img && img.naturalHeight > 300
      })
      const img = await page.$eval('.photo-show__img', img => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        src: img.src,
      }))
      if (img.width > img.height && img.width >= 1920 && img.height >= 1080) {
        const file = fs.createWriteStream(`${fileName}.jpg`)
        https.get(img.src, response => response.pipe(file))
        console.log(`Downloading ${fileName}: ${page.url()}`)
        break
      } else {
        console.log('Skipping photo with unsuitable size:', {
          width: img.width,
          height: img.height,
        })
      }
      const navs = await page.$$('[class^=Elements__PhotoNavigationWrapper]')
      await Promise.all([page.waitForNavigation(), navs.pop().click()])
    }
  }
  await browser.close()
})()
