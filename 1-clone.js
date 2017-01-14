'use strict'
const ChangesStream = require('changes-stream')
const Package = require('nice-package')
const level = require('level')
const levelgraph = require('levelgraph')
const through = require('through2')
const got = require('got')
const Gauge = require('gauge')

const db = levelgraph(level('npm'))
const gauge = new Gauge()
const registryUrl = 'https://replicate.npmjs.com'

function format (parent, child) {
  return {
    subject: parent,
    predicate: 'dependsOn',
    object: child
  }
}

got(registryUrl, {json: true}).then(response => {
  // Find out how many change objects there are total so we know when's a good time to stop.
  let finalUpdate = response.body.update_seq
  // Stream changes from the npmjs replication server...
  let changes = new ChangesStream({
    db: registryUrl,
    include_docs: true
  })
  changes.pipe(through.obj(function (change, encoding, done) {
    // Break each package up into triples like parent:dependsOn:child
    let pkg = new Package(change.doc)
    if (pkg.valid) {
      for (let dep of pkg.depNames) {
        this.push({
          subject: pkg.name,
          predicate: 'dependsOn',
          object: dep
        })
      }
    }
    gauge.show(pkg.name, change.seq / finalUpdate)
    // If we've reached a reasonable stopping point, lets stop gracefully
    if (change.seq >= finalUpdate) {
      // I *think* this will cause the event loop to cease and program termination but it'll be interesting to find out.
      // EDIT: Nope. It doesn't. Oh well.
      changes.pause()
    }
    return done()
  })).pipe(db.putStream()).on('close', function () {
    console.log('We did it!')
  })
})
