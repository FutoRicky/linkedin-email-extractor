
# combine-errors

  Simple, dependency-free way to combine multiple errors into one.

  This is useful for handling multiple asynchronous errors, where you want to catch all the errors and combine them to return just a single error.

## Features

- `error instanceof Error === true`
- composable: `error([error([err1, err2]), err3])`
- stack and message are combined in a nice way
- array-like object, so you can access the original errors by looping over the error
- If you just have one error, it looks exactly like raw error meaning, `error(err).message === err.message && error(err).stack === err.stack`
- zero dependencies
- should work in the browser, though I haven't tested it yet

## Installation

```
npm install combine-errors
```

## Usage

```js
var error = require('combine-errors')
var err = error([
  new Error('boom'),
  new Error('kablam')
])
throw err
```

## License

MIT
