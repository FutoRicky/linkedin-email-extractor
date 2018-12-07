function Nightmare(options) {
  if (!(this instanceof Nightmare)) return new Nightmare(options)
  this._options = options || {}
  this._queue = Promise.resolve()
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
 * Goto action
 */

Nightmare.prototype.goto = function(url) {
  return this._enqueue((resolve, reject) => {
    // goto implementation
  })
}
