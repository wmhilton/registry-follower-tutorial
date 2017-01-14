'use strict'
const watt = require('watt')
const level = require('level')
const levelgraph = require('levelgraph')
const through = require('through2')
// const got = require('got')
const Gauge = require('gauge')

const db = levelgraph(level('npm'))
const gauge = new Gauge()

// -- Get total
const main = watt(function* (next) {
  let results = yield db.get({predicate: 'downloads'}, next)
  let total = results.map(x => x.lastMonth).reduce((x, y) => x + y)
  console.log(total + ' total')

  results.map((x) => {
    x.weight = x.lastMonth / total
    return x
  })
  console.log(results)
  // NOTE: Putting +266265 items with `yield db.put(results, next)` at once
  // resulted in steady 35% CPU usage but 0% disk writing activity
  // for several minutes.
  //
  // Let's try a different approach.
  let numpkgs = results.length
  while (results.length > 0) {
    let batch = results.splice(0, 100)
    yield db.put(batch, next)
    gauge.show('progress', (1 - results.length / numpkgs))
  }
  gauge.hide()
  console.log('done')
})
main()

// // All packages that depend indirectly on X.
// db.searchStream([{
//   subject: db.v('x'),
//   predicate: 'dependsOn',
//   object: 'yael'
// }]).pipe(through.obj(function (result, encoding, done) {
//   this.push(result.x + '\n')
//   return done()
// })).pipe(process.stdout)
