var Browser = require('./src/browser')
var app = require('electron').app

async function main() {
  var browser = new Browser()
  var page = browser.newPage({ show: true })
  await page.ready()

  // console.log('page...', page)
  await page.goto('https://google.com')

  // console.log('hi')
  // throw new Error('oh noz.')
}

main()
  .catch(console.error)
  .then(() => app.quit())
