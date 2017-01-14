'use strict'
const watt = require('watt')
const level = require('level')
const levelgraph = require('levelgraph')
const through = require('through2')
// const got = require('got')
const Gauge = require('gauge')

const db = levelgraph(level('npm'))
const gauge = new Gauge()

const main = watt(function* (first, next) {
  let done = new Set()
  let queue = [first]
  let current
  while (queue.length) {
    current = queue.shift()
    let results = yield db.get({object: current, predicate: 'dependsOn'}, next)
    done.add(current)
    results = results.map(x => x.subject).filter(x => !done.has(x))
    results.map(x => queue.push(x))
    gauge.show(current, done.size / (done.size + queue.length))
    // yield setTimeout(next.arg(0), 100)
  }
  gauge.hide()
  // done.forEach(x => process.stdout.write(x + ' '))
  console.log(done.size)
})
main(process.argv[2])

// // All packages that depend indirectly on X.
// db.searchStream([{
//   subject: db.v('x'),
//   predicate: 'dependsOn',
//   object: 'yael'
// }]).pipe(through.obj(function (result, encoding, done) {
//   this.push(result.x + '\n')
//   return done()
// })).pipe(process.stdout)
