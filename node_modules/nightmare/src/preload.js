/* eslint-disable no-console */

var ipc = require('electron').ipcRenderer
var sliced = require('sliced')

function send(event) {
  var args = sliced(arguments, 1)
  ipc.send(event, args)
}

// offer limited access to allow
// .evaluate() and .inject()
// to work as is.
window.__nightmare = {}

// Listen for error events
window.addEventListener(
  'error',
  function(e) {
    send('page', 'error', e.message, (e.error || {}).stack || '')
  },
  true
)

// listen for console.log
var defaultLog = console.log
console.log = function() {
  send('console', 'log', sliced(arguments))
  return defaultLog.apply(this, arguments)
}

// listen for console.warn
var defaultWarn = console.warn
console.warn = function() {
  send('console', 'warn', sliced(arguments))
  return defaultWarn.apply(this, arguments)
}

// listen for console.error
var defaultError = console.error
console.error = function() {
  send('console', 'error', sliced(arguments))
  return defaultError.apply(this, arguments)
}

// overwrite the default alert
window.alert = function(message) {
  send('page', 'alert', message)
}

// overwrite the default prompt
window.prompt = function(message, defaultResponse) {
  send('page', 'prompt', message, defaultResponse)
}

// overwrite the default confirm
window.confirm = function(message, defaultResponse) {
  send('page', 'confirm', message, defaultResponse)
}
