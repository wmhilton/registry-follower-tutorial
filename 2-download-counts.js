'use strict'
const ChangesStream = require('changes-stream')
const through = require('through2')
const got = require('got')

const level = require('level')
const levelgraph = require('levelgraph')
const db = levelgraph(level('npm'))

const Gauge = require('gauge')
const gauge = new Gauge()
const registryUrl = 'https://replicate.npmjs.com'

got(registryUrl, {json: true}).then(response => {
  // Find out how many change objects there are total so we know when's a good time to stop.
  let finalUpdate = response.body.update_seq
  // Stream changes from the npmjs replication server...
  let changes = new ChangesStream({
    db: registryUrl,
    include_docs: true
  })
  changes.on('data', function (change) {
    // Break each package up into triples like parent:dependsOn:child
    let pkgName = change.doc.name
    got(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkgName)}`, {json: true})
    .then(response => {
      let downloads = response.body.downloads
      db.put({
        subject: pkgName,
        predicate: 'downloads',
        object: pkgName, // yes this is on purpose
        lastMonth: downloads || 0
      })
      gauge.show('...', change.seq / finalUpdate)
    }).catch(err => {
      console.log(err.statusCode + ' ' + pkgName)
    })
    // If we've reached a reasonable stopping point, lets stop gracefully
    if (change.seq >= finalUpdate) {
      // I *think* this will cause the event loop to cease and program termination but it'll be interesting to find out.
      // EDIT: Nope. It doesn't. Oh well.
      changes.pause()
      setTimeout(process.exit, 10000)
    }
    return
  })
})
