'use strict'
const watt = require('watt')
const level = require('level')
const levelgraph = require('levelgraph')
const through = require('through2')
const Gauge = require('gauge')

const db = levelgraph(level('graphnpm'))
const gauge = new Gauge()
const fs = require('fs')

const dependencies = {}
// -- Get total
const main = watt(function* (next) {
  console.log('running query...')
  db.getStream({predicate: 'dependsOn'}).pipe(through.obj(function (data, enc, callback) {
    if (dependencies[data.subject] === undefined) dependencies[data.subject] = []
    dependencies[data.subject].push(data.object)
    return callback()
  }))
  .on('finish', function () {
    console.log('building JSON')
    let str = JSON.stringify(dependencies)
    console.log('I have a string!')
    fs.writeFileSync('dependencies.json', str, 'utf-8')
    console.log('Wrote dependencies.json')
    console.log('done')
    process.exit()
  })
})
main()
