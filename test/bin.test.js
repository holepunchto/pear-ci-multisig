'use strict'
const test = require('brittle')
const { run, fixture } = require('./helper')
const { link } = require('..')

const VALID_CONFIG = require('./fixtures/valid/pear.json').multisig

test('link: outputs pear:// link for valid config', async function ({ ok }) {
  const { out } = await run('link', '--config', fixture('valid'))
  ok(out.startsWith('pear://'))
})

test('link: cli output matches module output', async function ({ is }) {
  const { out } = await run('link', '--config', fixture('valid'))
  is(out, link(VALID_CONFIG))
})

test('link: --quorum --namespace --pubkey flags', async function ({ is }) {
  const { out } = await run(
    'link',
    '--quorum',
    String(VALID_CONFIG.quorum),
    '--namespace',
    VALID_CONFIG.namespace,
    '--pubkey',
    VALID_CONFIG.publicKeys[0],
    '--pubkey',
    VALID_CONFIG.publicKeys[1],
    '--pubkey',
    VALID_CONFIG.publicKeys[2]
  )

  is(out, link(VALID_CONFIG))
})

test('link: errors on missing pear.multisig', async function ({ ok }) {
  const { err } = await run('link', '--config', fixture('no-multisig'))
  ok(err.includes('multisig field required'))
})

test('link: errors on missing namespace', async function ({ ok }) {
  const { err } = await run('link', '--config', fixture('no-namespace'))
  ok(err.includes('namespace required'))
})

test('link: errors on missing quorum', async function ({ ok }) {
  const { err } = await run('link', '--config', fixture('no-quorum'))
  ok(err.includes('quorum required'))
})

test('link: errors on missing publicKeys', async function ({ ok }) {
  const { err } = await run('link', '--config', fixture('no-signers'))
  ok(err.includes('publicKeys required'))
})

test('link: errors on empty publicKeys array', async function ({ ok }) {
  const { err } = await run('link', '--config', fixture('empty-signers'))
  ok(err.includes('publicKeys required'))
})
