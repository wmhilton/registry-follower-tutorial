let fs = require('fs')
let votes = require('./votes.json')
let authors = require('./authors.json')
let _ = require('lodash')
let scores = []

for (let author in authors) {
  let wrote = authors[author]
  let vote = wrote.map(pkg => votes[pkg] || 0).reduce((x, y) => x + y, 0)
  // console.log(`${author} wrote ${wrote.length} packages and scored ${vote}`)
  scores.push([author, vote])
}

let scoreObject = _.fromPairs(_.sortBy(scores, '1').reverse())

fs.writeFileSync('scores.json', JSON.stringify(scoreObject, null, '\t'), 'utf-8')
