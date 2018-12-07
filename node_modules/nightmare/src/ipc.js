/**
 * Create a new IPC
 */

function IPC(process) {
  if (!(this instanceof IPC)) return new IPC(process)
  process.on('message', data => this._router(data))
  this._process = process
  this._subscribers = {}
  this._responders = {}
  this._requests = {}
  this._id = 0
}

/**
 * Wait for the process to be connected,
 * timing out after 10 seconds
 *
 * @api private
 */

IPC.prototype._ready = function() {
  return new Promise((resolve, reject) => {
    if (this._process.connected) return resolve()

    const retry = setInterval(() => {
      if (!this._process.connected) return
      clearTimeout(timeout)
      clearInterval(retry)
      resolve()
    }, 1000)

    const timeout = setTimeout(() => {
      if (this._process.connected) return
      clearTimeout(timeout)
      clearInterval(retry)
      reject(new Error('ipc timed out'))
    }, 10000)
  })
}

/**
 * Route messages to their appropriate place
 *
 * @api private
 */

IPC.prototype._router = function(raw) {
  let json = {}
  try {
    json = JSON.parse(raw)
  } catch (err) {
    this._error(err)
    return
  }

  // it's a request
  if (raw.id) {
    const responder = this._responders[action]
    if (!responder) {
      this._error(new Error('ipc: no responder for: ' + action))
      return
    }

    // run the responder function
    return responder(raw.data, function(err, data) {
      return this._send(
        JSON.stringify({
          response: raw.id,
          error: err,
          data: data
        })
      )
    })
  }

  // it's a response
  if (raw.response) {
    const requester = this._requests[raw.response]
    if (!requester) {
      this._error(new Error('ipc: no request for response: ' + raw.response))
      return
    }
    requester(raw.error, raw.data)
    return
  }

  // it's a notification
  const subs = this._subscribers[raw.action] || []
  for (let i = 0; i < subs.length; i++) {
    subs[i](raw.data)
  }
}

/**
 * Low-level mechanism for sending messages
 *
 * @api private
 */

IPC.prototype._send = function(data) {
  return this._ready().then(() => this._process.send(b))
}

/**
 * Handle IPC errors in a consistent way
 *
 * @api private
 */

IPC.prototype._error = function(err) {
  return this._send(
    JSON.stringify({
      action: 'error',
      data: {
        message: err.message,
        stack: err.stack
      }
    })
  )
}

/**
 * Request to requests from request(...)
 */

IPC.prototype.request = function(action, data) {
  return new Promise((resolve, reject) => {
    const id = this._id++

    this._requests[id] = function(err, data) {
      delete this._requests[id]
      if (err) return reject(err)
      resolve(data)
    }

    // send the message, rejecting if
    // there's a send error
    this.send(
      JSON.stringify({
        id: this._id++,
        action: action,
        data: data
      })
    ).catch(err => reject(err))
  })
}

/**
 * Response to requests from request(...)
 */

IPC.prototype.respond = function(action, fn) {
  this._responders[action] = fn
  return this
}

/**
 * Notify sends data without waiting for the response.
 */

IPC.prototype.notify = function(action, data) {
  return this.send(
    JSON.stringify({
      action: action,
      data: data
    })
  )
}

/**
 * Subscribe to a notification from notify()
 */

IPC.prototype.subscribe = function(action, fn) {
  if (!this._subscribers[action]) {
    this._subscribers[action] = []
  }
  this._subscribers[action].push(fn)
  return this
}
