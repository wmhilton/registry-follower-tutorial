const fs = require('fs')
const level = require('level')
const sublevel = require('sublevel')
const db = sublevel(level('npm'))
const store = db.sublevel('store')
const through = require('through2')

let authors = {} // author -> [pkg]
// This is ridiculous. Bad design, William! Bad design.
store.createReadStream()
.pipe(through.obj(function (data, enc, callback) {
  let pkg = JSON.parse(data.value)
  if (pkg.author) {
    // console.log(pkg.author.name + pkg.name)
    if (authors[pkg.author.name] === undefined) authors[pkg.author.name] = []
    if (!authors[pkg.author.name].includes(pkg.name)) authors[pkg.author.name].push(pkg.name)
  }
  return callback()
}))
.on('finish', function () {
  // todo: ensure all callbacks have run
  setTimeout(function () {
    fs.writeFileSync('authors.json', JSON.stringify(authors, null, '\t'), 'utf-8')
  }, 2000)
})
