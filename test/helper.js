'use strict'
const { join } = require('path')
const BIN = require.resolve('../bin')
const FIXTURES = join(__dirname, 'fixtures')

function run(...args) {
  return new Promise((resolve) => {
    let out = null
    let err = null
    const program = global.process ?? global.Bare
    const savedArgv = program.argv.slice()
    const origLog = console.log
    const origErr = console.error
    const origExit = program.exit

    const restore = () => {
      console.log = origLog
      console.error = origErr
      program.exit = origExit
      program.argv.length = 0
      program.argv.push(...savedArgv)
    }

    console.log = (msg) => {
      out = msg
      restore()
      resolve({ out, err })
    }
    console.error = (msg) => {
      err = msg
    }
    program.exit = () => {
      restore()
      resolve({ out, err })
    }

    program.argv.length = 0
    program.argv.push(global.Bare ? 'bare' : 'node', 'bin.js', ...args)

    delete require.cache[BIN]
    delete require.cache['file://' + BIN]
    require(BIN)
  })
}

function fixture(name) {
  return join(FIXTURES, name, 'pear.json')
}

module.exports = { run, fixture }
