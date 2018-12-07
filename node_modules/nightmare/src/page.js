/**
 * Module dependencies
 */

const { BrowserWindow, app, ipcMain: rendererIPC } = require('electron')
const defaults = require('deep-defaults')
const urlFormat = require('url')

/**
 * URL protocols that don't need to be checked for validity
 */

const KNOWN_PROTOCOLS = ['http', 'https', 'file', 'about', 'javascript']

/**
 * Export `Page`
 */

module.exports = Page

/**
 * Page
 */

function Page(options, onClose) {
  if (!(this instanceof Page)) {
    return new Page(options, onClose)
  }

  // setup the page queue
  this._queue = Promise.resolve()

  // enqueue to actions
  this._appReady()
  this._open(options)
}

/**
 * Enqueues the actions
 *
 * @api private
 */

Page.prototype._enqueue = function(fn) {
  this._queue = this._queue.then(() => new Promise(fn))
  return this
}

/**
 * Nightmare implements .then() to create a "thenable"
 */

Page.prototype.then = function(success, failure) {
  return this._queue.then(success).catch(failure)
}

/**
 * Nightmare implements .catch() to create a "thenable"
 */

Page.prototype.catch = function(failure) {
  return this._queue.catch(failure)
}

/**
 * Wait until the electron app is ready
 */

Page.prototype._appReady = function() {
  return this._enqueue((resolve, _reject) => {
    if (app.isReady()) return resolve()
    app.once('ready', () => resolve())
  })
}

/**
 * Open a new window for this page
 */

Page.prototype._open = function(options) {
  return this._enqueue((resolve, reject) => {
    // open a new window
    const win = (this._win = new BrowserWindow(options))
    if (options.show && options.openDevTools) {
      if (typeof options.openDevTools === 'object') {
        win.openDevTools(options.openDevTools)
      } else {
        win.openDevTools()
      }
    }

    // Get the webcontent id
    this.pid = win.webContents.getOSProcessId()

    // mute the audio
    win.webContents.setAudioMuted(true)

    // Setup the frame manager
    // this.frameManager = FrameManager(this.window)

    // pass along page events to nightmare
    rendererIPC.on('page', function(sender /*, arguments, ... */) {
      // parent.emit.apply(parent, ['page'].concat(sliced(arguments, 1)))
    })

    // pass along console events to nightmare
    rendererIPC.on('console', function(sender, type, args) {
      // parent.emit.apply(parent, ['console', type].concat(args))
    })

    // webcontents events to listen for
    ;[
      'did-finish-load',
      'did-fail-load',
      'did-fail-provisional-load',
      'did-frame-finish-load',
      'did-start-loading',
      'did-stop-loading',
      'did-get-response-details',
      'did-get-redirect-request',
      'dom-ready',
      'page-favicon-updated',
      'new-window',
      'will-navigate',
      'crashed',
      'plugin-crashed',
      'destroyed',
      'media-started-playing',
      'media-paused'
    ].map(event => {
      win.webContents.on(event, forward(event))
    })

    win.webContents.on('close', e => {
      // closed = true
    })

    var loadwatch
    win.webContents.on('did-start-loading', function() {
      if (win.webContents.isLoadingMainFrame()) {
        if (options.loadTimeout) {
          loadwatch = setTimeout(function() {
            win.webContents.stop()
          }, options.loadTimeout)
        }
        // setIsReady(false)
      }
    })

    win.webContents.on('did-stop-loading', function() {
      clearTimeout(loadwatch)
      // setIsReady(true)
    })

    // setIsReady(true)

    // Forward events
    function forward(name) {
      return function(event) {
        // NOTE: the raw Electron event used to be forwarded here, but we now send
        // an empty event in its place -- the raw event is not JSON serializable.
        // if (!closed) {
        //   // parent.emit.apply(parent, [name, {}].concat(sliced(arguments, 1)))
        // }
      }
    }

    resolve()
  })
}

/**
 * Ready
 */

Page.prototype.ready = function() {
  return this._enqueue((resolve, _reject) => resolve(true))
}

/**
 * Goto implementation
 */

Page.prototype.goto = function(url, headers, options) {
  return this._enqueue((resolve, reject) => {
    const win = this._win

    if (!url || typeof url !== 'string') {
      return reject(new Error('goto: `url` must be a non-empty string'))
    }

    if (win.webContents.getURL() == url) {
      return resolve()
    }

    headers = headers || {}
    options = defaults(options || {}, {
      timeout: 30 * 1000
    })

    var httpReferrer = ''
    var extraHeaders = ''
    for (var key in headers) {
      if (key.toLowerCase() == 'referer') {
        httpReferrer = headers[key]
        continue
      }

      extraHeaders += key + ': ' + headers[key] + '\n'
    }
    var loadUrlOptions = { extraHeaders: extraHeaders }
    httpReferrer && (loadUrlOptions.httpReferrer = httpReferrer)

    var responseData = {}
    var domLoaded = false

    var timer = setTimeout(function() {
      // If the DOM loaded before timing out, consider the load successful.
      var error = domLoaded
        ? undefined
        : {
            message: 'navigation error',
            code: -7, // chromium's generic networking timeout code
            details: `Navigation timed out after ${options.timeout} ms`,
            url: url
          }

      // Even if "successful," note that some things didn't finish.
      responseData.details = `Not all resources loaded after ${
        options.timeout
      } ms`
      cleanup(error, responseData)
    }, options.timeout)

    function handleFailure(event, code, detail, failedUrl, isMainFrame) {
      if (isMainFrame) {
        cleanup({
          message: 'navigation error',
          code: code,
          details: detail,
          url: failedUrl || url
        })
      }
    }

    function handleDetails(
      event,
      status,
      newUrl,
      oldUrl,
      statusCode,
      method,
      referrer,
      headers,
      resourceType
    ) {
      if (resourceType === 'mainFrame') {
        responseData = {
          url: newUrl,
          code: statusCode,
          method: method,
          referrer: referrer,
          headers: headers
        }
      }
    }

    function handleDomReady() {
      domLoaded = true
    }

    // We will have already unsubscribed if load failed, so assume success.
    function handleFinish(event) {
      cleanup(null, responseData)
    }

    function cleanup(err, data) {
      clearTimeout(timer)
      win.webContents.removeListener('did-fail-load', handleFailure)
      win.webContents.removeListener('did-fail-provisional-load', handleFailure)
      win.webContents.removeListener('did-get-response-details', handleDetails)
      win.webContents.removeListener('dom-ready', handleDomReady)
      win.webContents.removeListener('did-finish-load', handleFinish)
      // setIsReady(true)
      // wait a tick before notifying to resolve race conditions for events
      setImmediate(() => (err ? reject(err) : resolve(data)))
    }

    // In most environments, loadURL handles this logic for us, but in some
    // it just hangs for unhandled protocols. Mitigate by checking ourselves.
    function canLoadProtocol(protocol, callback) {
      protocol = (protocol || '').replace(/:$/, '')
      if (!protocol || KNOWN_PROTOCOLS.includes(protocol)) {
        return callback(true)
      }
      electron.protocol.isProtocolHandled(protocol, callback)
    }

    function startLoading() {
      // abort any pending loads first
      if (win.webContents.isLoading()) {
        // parent.emit('log', 'aborting pending page load')
        win.webContents.once('did-stop-loading', function() {
          startLoading(true)
        })
        return win.webContents.stop()
      }

      win.webContents.on('did-fail-load', handleFailure)
      win.webContents.on('did-fail-provisional-load', handleFailure)
      win.webContents.on('did-get-response-details', handleDetails)
      win.webContents.on('dom-ready', handleDomReady)
      win.webContents.on('did-finish-load', handleFinish)
      win.webContents.loadURL(url, loadUrlOptions)

      // javascript: URLs *may* trigger page loads; wait a bit to see
      if (protocol === 'javascript:') {
        setTimeout(function() {
          if (!win.webContents.isLoadingMainFrame()) {
            done(null, {
              url: url,
              code: 200,
              method: 'GET',
              referrer: win.webContents.getURL(),
              headers: {}
            })
          }
        }, 10)
      }
    }

    var protocol = urlFormat.parse(url).protocol
    canLoadProtocol(protocol, function startLoad(canLoad) {
      if (canLoad) {
        // parent.emit(
        //   'log',
        //   `Navigating: "${url}",
        //     headers: ${extraHeaders || '[none]'},
        //     timeout: ${options.timeout}`
        // )
        return startLoading()
      }

      cleanup({
        message: 'navigation error',
        code: -1000,
        details: 'unhandled protocol',
        url: url
      })
    })
  })
}

/**
 * Evaluate now
 */

Page.prototype.evaluate_now = function(src) {}
