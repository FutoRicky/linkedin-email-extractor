var error = require('./')

var a = new Error('a')

console.log('error(a).message === a.message', error(a).message === a.message)
console.log('error(a).stack === a.stack', error(a).stack === a.stack)
console.log('error(a) instanceof Error', error(a) instanceof Error)
// throw error(a)
// throw a
