'use strict'
const got = require('got')
const thru = require('thru')

const level = require('level')
const sublevel = require('sublevel')
const db = sublevel(level('npm'))
const store = db.sublevel('store')
const downloads = db.sublevel('metrics').sublevel('downloads')

const Gauge = require('gauge')
const gauge = new Gauge()

function stripVersion () {
  return thru(function (obj, cb) {
    cb(null, obj.replace(/\|.*$/, ''))
  })
}

function filterDuplicates () {
  const seen = new Set()
  return thru(function filterDuplicatesInstance (obj, cb) {
    if (seen.has(obj)) {
      cb()
    } else {
      seen.add(obj)
      cb(null, obj)
    }
  })
}

function getDownloadCounts () {
  return thru(function getDownloadCountInstance (obj, cb) {
    got(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(obj)}`, {json: true})
    .then(response => {
      let downloadCount = response.body.downloads
      downloads.put(obj, downloadCount || 0, () => {
        cb(null, obj)
      })
    }).catch(err => {
      // we dont care about errors
      cb(null, obj)
    })
  })
}

let globalDoneCount = 0
function countKeys () {
  let counter = 0
  return thru(function countKeysInstance (obj, cb) {
    counter++
    cb(null, counter)
  })
}

function updateProgress (total) {
  let counter = 0
  return thru(function (obj, cb) {
    counter++
    gauge.show(obj, counter / total)
    cb()
  })
}

// TODO: Get # of package names first, create progress bar, then get download counts.
function getPackageNameStream () {
  return store.createKeyStream().pipe(stripVersion()).pipe(filterDuplicates())
}
// Get # of packages
function getNumberOfPackages (cb) {
  let counter = 0
  getPackageNameStream().pipe(countKeys()).on('data', (c) => {
    counter = c
  }).on('finish', () => {
    cb(null, counter)
  })
  return
}

getNumberOfPackages((err, count) => {
  getPackageNameStream()
  .pipe(getDownloadCounts())
  .pipe(updateProgress(count))
})
