'use strict'
const thru = require('thru')
const pad = require('pad')
const level = require('level')
const sublevel = require('level-sublevel')
const db = level('npm')
const ws = require('level-write-stream')
const tee = require('tee')
const miss = require('mississippi')
const es = require('event-stream')
const ReadableStream = require('stream').Readable
const downloads = sublevel(db).sublevel('metrics').sublevel('downloads')
// const downloads = db.sublevel('metrics').sublevel('downloads')
const index = sublevel(db).sublevel('index').sublevel('downloads')
const log = require('./fast-log')

const Gauge = require('gauge')
const gauge = new Gauge()

function countKeys () {
  let counter = 0
  return thru(function countKeysInstance (obj, cb) {
    counter++
    cb(null, counter)
  })
}

function getOldDownloadCountStream () {
  // return downloads.createReadStream()
  return db.createReadStream({
    gte: '\u0000/\u0000metrics/\u0000downloads/\u0001',
    lte: '\u0000/\u0000metrics/\u0000downloads/\u0001\xFF'
  })
}

function putNewDownloadCountStream () {
  return thru(function (obj, cb) {
    let key = obj.key.replace('\u0000/\u0000metrics/\u0000downloads/\u0001', '')
    downloads.put(key, obj.value, () => {
      cb(null, {key: key, value: obj.value})
    })
  })
}

function getDownloadCountStream () {
  return downloads.createReadStream()
}

function formatSortedIndex (opts) {
  let padding = opts.padding
  return thru(function ({key, value}, cb) {
    let ikey = pad(padding, value, '0') + '|' + key
    cb(null, {key: ikey, value: ''})
  })
}

function putIndex () {
  return thru(function ({key, value}, cb) {
    index.put(key, value, () => {
      cb()
    })
  })
}

// Get # of packages
function getNumberOfPackages (cb) {
  let counter = 0
  getOldDownloadCountStream().pipe(countKeys()).on('data', (c) => {
    counter = c
  }).on('finish', () => {
    cb(null, counter)
  })
  return
}

function reduce (val, fn) {
  let from = thru(function (val, cb) {
    cb(null, val)
  })
  let to = miss.to.obj(function (obj, enc, cb) {
    val = fn(val, obj.value)
    cb()
  }, function (cb) {
    from.end(val)
  })
  return miss.duplex.obj(to, from)
}

function max () {
  return reduce(0, Math.max)
}

function updateProgress (total) {
  let counter = 0
  return thru(function (obj, cb) {
    counter++
    gauge.show(obj.key, counter / total)
    cb(null, obj)
  })
}

function logThrough () {
  return thru(function (obj, cb) {
    log(obj)
    return cb(null, obj)
  })
}

function logSink () {
  return thru(function (obj, cb) {
    log(obj)
    return cb()
  })
}

var LevelBatch = require('level-batch-stream')
var BatchStream = require('batch-stream')
var parallel = require('concurrent-writable')

getNumberOfPackages((err, count) => {
  console.log(count)
  getDownloadCountStream()
  .pipe(max())
  .pipe(es.wait(function (err, body) {
    console.log(body)
    const digits = String(body).length + 1
    console.log(digits)
    getDownloadCountStream()
    .pipe(formatSortedIndex({padding: digits}))
    .pipe(updateProgress(count))
    .pipe(thru(function ({key, value}, cb) {
      cb(null, { type: 'put', key, value })
    }))
    .pipe(new BatchStream({ size: 100 }))
    .pipe(parallel(new LevelBatch(index), 10))
  }))
  .on('error', (err) => {
    console.log(err)
  })
  .on('close', () => {
    console.log('the end')
  })
})
