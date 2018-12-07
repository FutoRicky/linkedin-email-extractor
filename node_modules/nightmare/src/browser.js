/**
 * Module Dependencies
 */

var IPC = require('./ipc')
var rendererIPC = require('electron').ipcMain
var electron = require('electron')
var BrowserWindow = electron.BrowserWindow
var defaults = require('deep-defaults')
var join = require('path').join
var sliced = require('sliced')
var app = require('electron').app
var fs = require('fs')
var urlFormat = require('url')
const Page = require('./page')

/**
 * support being spawned from the nightmare
 * process or treated as a library in an
 * existing electron (main) process.
 */

const calledFromNightmare = process.send
if (calledFromNightmare) {
  console.log('from nightmare')
}

/**
 * Export `Browser`
 */

module.exports = Browser

/**
 * Initialize `Browser`
 */

function Browser(options) {
  if (!(this instanceof Browser)) {
    return new Browser(options)
  }

  // setup the options
  this._options = defaults(options || {}, {
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false
    },
    nightmareIPC: null
  })

  // browser state
  this._queue = Promise.resolve()
  this._pages = []
}

/**
 * Enqueues the actions
 *
 * @api private
 */

Browser.prototype._enqueue = function(fn) {
  this._queue = this._queue.then(() => new Promise(fn))
  return this
}

/**
 * Nightmare implements .then() to create a "thenable"
 */

Browser.prototype.then = function(success, failure) {
  return this._queue.then(success).catch(failure)
}

/**
 * Nightmare implements .catch() to create a "thenable"
 */

Browser.prototype.catch = function(failure) {
  return this._queue.catch(failure)
}

/**
 * Open a new Page
 */

Browser.prototype.newPage = function(options) {
  options = defaults(options || {}, this._options)

  // get the initial length
  const len = this._pages.length

  // create the page
  const page = new Page(options, err => {
    this._pages.splice(len, 1)
  })
  this._pages.push(page)

  return page
}
