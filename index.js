const https = require('https')
const fs = require('fs')
const puppeteer = require('puppeteer')

const paths = {
  wallpaper: 'popular/landscapes',
  lockscreen: 'editors/landscapes',
}

;(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1888, height: 800 },
  })
  const page = await browser.newPage()
  for (const fileName in paths) {
    const path = paths[fileName]
    await page.goto(`https://500px.com/${path}`)
    await page.waitForSelector('.photo_thumbnail')
    await Promise.all([
      page.waitForNavigation(),
      page.click('.photo_thumbnail'),
    ])
    for (let i = 0; i < 20; i++) {
      await page.waitFor(() => {
        const img = document.querySelector('.photo-show__img')
        return img && (img.naturalWidth > 200 || img.naturalHeight > 300)
      })
      const img = await page.$eval('.photo-show__img', img => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
        src: img.src,
      }))
      console.log(img)
      if (img.width > img.height && img.width >= 1920 && img.height >= 1080) {
        const file = fs.createWriteStream(`${fileName}.jpg`)
        https.get(img.src, response => response.pipe(file))
        break
      }
      const navs = await page.$$('[class^=Elements__PhotoNavigationWrapper]')
      await Promise.all([page.waitForNavigation(), navs.pop().click()])
    }
  }
  await browser.close()
})()
