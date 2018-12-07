/**
 * This allows us to include nightmare
 * in an existing electron application
 */

const callingFromElectron = process.type === 'browser'
if (callingFromElectron) {
  module.exports = require('./browser')
  return
}

/**
 * Dependencies
 */

const defaultElectronPath = require('electron')
const defaults = require('deep-defaults')
const cp = require('child_process')
const split2 = require('split2')
const path = require('path')
const IPC = require('./ipc')
const api = require('./api')

/**
 * Nightmare's script for main script
 */

const scriptPath = path.join(__dirname, 'electron.js')

/**
 * Avoid complaints from node
 */

process.setMaxListeners(Infinity)

/**
 * Export `Nightmare`
 */

module.exports = Nightmare

/**
 * Mixin the `api`
 */

for (let key in api) Nightmare.prototype[key] = api[key]

/**
 * Default options
 */

const defaultOptions = {
  // Standard timeout for loading URLs in  ms
  gotoTimeout: 30 * 1000,

  // Standard timeout for wait in ms
  waitTimeout: 30 * 1000,

  // Timeout between keystrokes for `.type()` in ms
  typeInterval: 100,

  // timeout between `wait` polls in ms
  pollInterval: 250,

  // max execution time for `.evaluate()`
  executionTimeout: 30 * 1000,

  // max retry for authentication
  maxAuthRetries: 3,

  // Specify a custom promise
  Promise: Promise,

  // choose your own electron path
  electronPath: defaultElectronPath,

  // Custom Paths:
  // https://electronjs.org/docs/api/app#appgetpathname
  paths: {},

  // Switches:
  // https://electronjs.org/docs/api/chrome-command-line-switches
  switches: {},

  // null is a valid value, which will result in the use of the electron default behavior, which is to persist storage.
  // The default behavior for nightmare will be to use non-persistent storage.
  // http://electron.atom.io/docs/api/browser-window/#new-browserwindowoptions
  webPreferences: {
    // Non-persistent partition to use by default
    partition: 'nightmare'
  },

  // Don't display in the dock (OSX-only)
  dock: false,

  // No certificate subject
  certificateSubjectName: null,

  // Default process environment
  env: {}
}

/**
 * Initialize `Nightmare`
 */

function Nightmare(options) {
  if (!(this instanceof Nightmare)) return new Nightmare(options)

  // state
  this._options = defaults(options || {}, defaultOptions)
  this._queue = Promise.resolve()
  this._electronProcess = null
  this._activeRejection = null
  this._mainIPC = null

  // custom electron arguments
  this._electronArgs = {}
  if (options.paths) {
    this._electronArgs.paths = options.paths
  }
  if (options.switches) {
    this._electronArgs.switches = options.switches
  }

  // trap nightmare process signals
  this.untrap = trap(process, () => {
    this._close()
  })

  // queue spawning an electron process first
  this._spawn(options)
}

/**
 * enqueues the actions
 *
 * @api private
 */

Nightmare.prototype._enqueue = function(fn) {
  this._queue = this._queue.then(() => new Promise(fn))
  return this
}

/**
 * spawns an electron process
 *
 * @api private
 */

Nightmare.prototype._spawn = function(options) {
  return this._enqueue((resolve, reject) => {
    // spawn the electron process
    this._electronProcess = cp.spawn(
      this._options.electronPath,
      [scriptPath].concat(JSON.stringify(this._electronArgs)),
      {
        stdio: [null, null, null, 'ipc'],
        env: defaults(this._options.env, process.env)
      }
    )

    // listen for stdout
    this._electronProcess.stdout.pipe(split2()).on('data', data => {
      console.log(data)
    })

    // listen for stderr
    this._electronProcess.stderr.pipe(split2()).on('data', data => {
      console.error(data)
    })

    // setup the IPC to the main electron process
    this._mainIPC = new IPC(this._electronProcess)

    this._mainIPC.once('die', function(err) {
      debug('dying: ' + err)
      self.die = err
    })

    // propagate console.log(...) through
    this._mainIPC.on('log', function() {
      log.apply(log, arguments)
    })

    this._mainIPC.on('uncaughtException', function(stack) {
      // console.error(
      //   'Nightmare runner error:\n\n%s\n',
      //   '\t' + stack.replace(/\n/g, '\n\t')
      // )
      // endInstance(self, noop)
      // process.exit(1)
    })

    // this._ipcMain.on('page', function(type) {
    //   log.apply(null, ['page-' + type].concat(sliced(arguments, 1)))
    // })

    // // propogate events through to debugging
    // this._ipcMain.on('did-finish-load', function() {
    //   log('did-finish-load', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-fail-load', function() {
    //   log('did-fail-load', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-fail-provisional-load', function() {
    //   log('did-fail-provisional-load', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-frame-finish-load', function() {
    //   log('did-frame-finish-load', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-start-loading', function() {
    //   log('did-start-loading', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-stop-loading', function() {
    //   log('did-stop-loading', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-get-response-details', function() {
    //   log('did-get-response-details', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('did-get-redirect-request', function() {
    //   log('did-get-redirect-request', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('dom-ready', function() {
    //   log('dom-ready', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('page-favicon-updated', function() {
    //   log('page-favicon-updated', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('new-window', function() {
    //   log('new-window', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('will-navigate', function() {
    //   log('will-navigate', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('crashed', function() {
    //   log('crashed', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('plugin-crashed', function() {
    //   log('plugin-crashed', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('destroyed', function() {
    //   log('destroyed', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('media-started-playing', function() {
    //   log('media-started-playing', JSON.stringify(sliced(arguments)))
    // })
    // this._ipcMain.on('media-paused', function() {
    //   log('media-paused', JSON.stringify(sliced(arguments)))
    // })

    this._ipcMain.once('ready', versions => {
      this.engineVersions = versions
      this._ipcMain.call('browser-initialize', options, function() {
        self.state = 'ready'
        done()
      })
    })
  })
}

/**
 * run the code now (do not queue it)
 *
 * you should not use this, unless you know what you're doing
 * it should be used for plugins and custom actions, not for
 * normal API usage
 *
 * @api private
 */

Nightmare.prototype.evaluate_now = function(js_fn, done) {
  var args = Array.prototype.slice
    .call(arguments)
    .slice(2)
    .map(a => {
      return { argument: JSON.stringify(a) }
    })

  var source = template.execute({ src: String(js_fn), args: args })
  this.child.call('javascript', source, done)
  return this
}

/**
 * Run the queue, returning the results.
 * This is deprecated and only here for
 * backwards compatibility.
 *
 * @deprecated
 */

Nightmare.prototype.run = function(fn) {
  this._queue = this._queue.then(v => fn(null, v)).catch(e => fn(e))
  return this
}

/**
 * End drains the queue and shuts down
 * the electron process gracefully
 *
 * @param {(err: Error) => void?} callback
 */
Nightmare.prototype.end = function(callback) {
  return this._enqueue((resolve, reject) => {})
}

/**
 * Close the electron process gracefully
 *
 * @api private
 */

Nightmare.prototype._close = once(function(callback) {
  // stop trapping nightmare signals
  this.untrap()

  const ep = this._electronProcess
  if (!ep || !ep.connected) {
    callback(new Error('electron process not running'))
    return
  }

  // listen for the close event
  ep.once('close', code => {})
})

/**
 * Nightmare implements .then() to create a "thenable"
 */

Nightmare.prototype.then = function(success, failure) {
  return this._queue.then(success).catch(failure)
}

/**
 * Nightmare implements .catch() to create a "thenable"
 */

Nightmare.prototype.catch = function(failure) {
  return this._queue.catch(failure)
}

/**
 * Signal handler
 */

function trap(process, handler) {
  process.on('exit', handler)
  process.on('SIGINT', handler)
  process.on('SIGTERM', handler)
  process.on('SIGQUIT', handler)
  process.on('SIGHUP', handler)
  process.on('SIGBREAK', handler)

  return function untrap() {
    process.removeListener('exit', handler)
    process.removeListener('SIGINT', handler)
    process.removeListener('SIGTERM', handler)
    process.removeListener('SIGQUIT', handler)
    process.removeListener('SIGHUP', handler)
    process.removeListener('SIGBREAK', handler)
  }
}

/**
 * Once helper
 */

function once(fn) {
  let called = false
  return function() {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}
