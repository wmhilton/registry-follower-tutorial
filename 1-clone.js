'use strict'
const inspect = require('util').inspect
const _ = require('lodash')
const ChangesStream = require('changes-stream')
const cleanMetadata = require('normalize-registry-metadata')
const cleanPackage = require('normalize-package-data')
const level = require('level')
const sublevel = require('sublevel')
const levelgraph = require('levelgraph')
const through = require('through2')
const got = require('got')
const Gauge = require('gauge')

const db = sublevel(level('npm'))
const store = db.sublevel('store')
const graph = levelgraph(db.sublevel('graph'))
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
  changes.pipe(through.obj(function (change, encoding, done) {
    let pkg = change.doc
    // Ignore design docs
    if (!pkg.name) return done()
    // Break each package up into triples like parent:dependsOn:child
    cleanMetadata(pkg)
    if (pkg['dist-tags'] && pkg['dist-tags']['latest'] && pkg.versions && pkg.versions[pkg['dist-tags']['latest']]) {
      pkg = _.assign(pkg, pkg.versions[pkg['dist-tags']['latest']])
    }
    cleanPackage(pkg) //, console.error)
    pkg = _.omit(pkg, ['readme', 'versions', 'files', 'directories'])
    pkg = _.omitBy(pkg, (v, k) => _.startsWith(k, '_'))
    if (pkg.time && pkg.time.modified) {
      pkg.time = pkg.time.modified
    }
    //   if (pkg.dependencies) {
    //     for (let dep in pkg.dependencies) {
    //       this.push({
    //         subject: pkg.name,
    //         predicate: 'dependsOn',
    //         object: dep,
    //         version: pkg.version,
    //         semver: pkg.dependencies[dep]
    //       })
    //     }
    //   }
    //   if (pkg.devDependencies) {
    //     for (let dep in pkg.devDependencies) {
    //       this.push({
    //         subject: pkg.name,
    //         predicate: 'devDependsOn',
    //         object: dep,
    //         version: pkg.version,
    //         semver: pkg.devDependencies[dep]
    //       })
    //     }
    //   }
    gauge.show(pkg.name, change.seq / finalUpdate)
    // If we've reached a reasonable stopping point, lets stop gracefully
    if (change.seq >= finalUpdate) {
      changes.pause()
      setTimeout(process.exit, 10000)
    }
    // Store raw data
    return store.put(pkg.name + '|' + pkg.version, JSON.stringify(pkg), done)
  }))
})
