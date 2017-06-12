'use strict'
const dependencies = require('./dependencies.json') // pkg -> [pkg]
let votes = {} // pkg -> vote count
let authors = {} // author -> [pkg]
let best = {} // author -> total vote count
const fs = require('fs')
// todo, filter out authors own contributions to themself?

for (let pkg in dependencies) {
  for (let dep of dependencies[pkg]) {
    if (votes[dep] === undefined) {
      votes[dep] = 0
    } else {
      votes[dep] += 1
    }
  }
}

// Sort object properties. Depends on V8 printing properties in insertion order, but hey works for now.
// https://stackoverflow.com/a/39442287/2168416
votes = Object
 .keys(votes)
 .sort((a, b) => votes[b] - votes[a])
 .reduce((_sortedObj, key) => {
   _sortedObj[key] = votes[key]
   return _sortedObj
 }, {})

fs.writeFileSync('votes.json', JSON.stringify(votes, null, '\t'), 'utf-8')
