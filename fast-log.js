const thru = require('thru')
const stdoutStream = require('stdout-stream')

function log (obj) {
  stdoutStream.write(JSON.stringify(obj) + '\n')
}

module.exports = log