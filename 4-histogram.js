'use strict'
const thru = require('thru')
const level = require('level')
const sublevel = require('level-sublevel')
const db = level('npm')
const es = require('event-stream')
const miss = require('mississippi')
// const downloads = db.sublevel('metrics').sublevel('downloads')
const index = sublevel(db).sublevel('index').sublevel('downloads')
const log = require('./fast-log')

const Gauge = require('gauge')
const gauge = new Gauge()

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


function countKeys () {
  let counter = 0
  return thru(function countKeysInstance (obj, cb) {
    counter++
    cb(null, counter)
  })
}

function histogram () {
  let last = null
  let count = 0
  let sum = 0
  let from = thru(function (val, cb) {
    cb(null, val)
  })
  let to = miss.to.obj(function (key, enc, cb) {
    // Round key to nearest log 10
    key = parseInt(key)
    sum += key
    key = Math.trunc(Math.log10(key))
    key = Math.pow(10, key)
    if (key === last || last === null) {
      count++
    } else {
      from.push({key: key, value: count, sum})
      count = 1
      sum = 0
    }
    last = key
    cb()
  }, function (cb) {
    from.push({key: last, value: count, sum})
    from.end()
  })
  return miss.duplex.obj(to, from)
}

function reduce (val, fn) {
  let from = thru(function (val, cb) {
    cb(null, val)
  })
  let to = miss.to.obj(function (obj, enc, cb) {
    val = fn(val, obj)
    cb()
  }, function (cb) {
    from.push(val)
    from.end()
  })
  return miss.duplex.obj(to, from)
}


// index.createKeyStream()
// .pipe(thru(function (key, cb) {
//   key = key.replace(/\|.*$/, '')
//   if (parseInt(key) > 1000000) {
//     cb(null, key)
//   } else {
//     cb()
//   }
// }))
// .pipe(countKeys())
// .pipe(logSink())

index.createKeyStream()
.pipe(thru(function (key, cb) {
  cb(null, key.replace(/\|.*$/, ''))
}))
.pipe(histogram())
.pipe(thru(function (obj, cb) {
  console.log(obj.key + '\t' + obj.value + '\t' + obj.sum)
  cb()
}))
// .pipe(reduce([], (a, x) => {
//   a.push(x.value)
//   return a
// }))
// .on('data', function (data, enc, cb) {
//   console.log('data =', JSON.stringify(data))
//   const sparkly = require('sparkly')
//   console.log(sparkly(data))
// })
.on('error', (err) => {
  console.log(err)
})
.on('close', () => {
  console.log('the end')
})
