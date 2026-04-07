'use strict'
const test = require('brittle')
const plink = require('pear-link')
const { link } = require('..')

const PUBKEYS = [
  'yryonyebyryonyebyryonyebyryonyebyryonyebyryonyebyryo',
  'yebyryonyebyryonyebyryonyebyryonyebyryonyebyryonyeby',
  'ycbogyadycbogyadycbogyadycbogyadycbogyadycbogyadycbo'
]

test('returns a pear:// link string', async function ({ ok }) {
  const result = link({
    publicKeys: PUBKEYS,
    namespace: 'test/app',
    quorum: 2
  })
  ok(typeof result === 'string')
  ok(result.startsWith('pear://'))
})

test('returned link is valid pear link', async function ({ is, ok }) {
  const result = link({
    publicKeys: PUBKEYS,
    namespace: 'test/app',
    quorum: 2
  })
  const parsed = plink.parse(result)
  is(parsed.protocol, 'pear:')
  ok(Buffer.isBuffer(parsed.drive.key))
  is(parsed.drive.key.length, 32)
})

test('is deterministic', async function ({ is }) {
  const config = { publicKeys: PUBKEYS, namespace: 'test/app', quorum: 2 }
  is(link(config), link(config))
})

test('different publicKeys produce different links', async function ({ not }) {
  const a = link({
    publicKeys: PUBKEYS.slice(0, 2),
    namespace: 'test/app',
    quorum: 1
  })
  const b = link({
    publicKeys: PUBKEYS.slice(1),
    namespace: 'test/app',
    quorum: 1
  })
  not(a, b)
})

test('different namespaces produce different links', async function ({ not }) {
  const a = link({
    publicKeys: PUBKEYS,
    namespace: 'org/app-a',
    quorum: 2
  })
  const b = link({
    publicKeys: PUBKEYS,
    namespace: 'org/app-b',
    quorum: 2
  })
  not(a, b)
})

test('different quorum values produce different links', async function ({
  not
}) {
  const a = link({
    publicKeys: PUBKEYS,
    namespace: 'test/app',
    quorum: 2
  })
  const b = link({
    publicKeys: PUBKEYS,
    namespace: 'test/app',
    quorum: 3
  })
  not(a, b)
})

test('throws on missing namespace', async function ({ exception }) {
  exception(() => link({ publicKeys: PUBKEYS, quorum: 2 }), {
    message: 'namespace required'
  })
})

test('throws on empty namespace', async function ({ exception }) {
  exception(() => link({ publicKeys: PUBKEYS, namespace: '', quorum: 2 }), {
    message: 'namespace required'
  })
})

test('throws on invalid public key', async function ({ exception }) {
  const invalid = 'notavalidkey'
  exception(
    () =>
      link({
        publicKeys: [invalid, ...PUBKEYS],
        namespace: 'test/app',
        quorum: 2
      }),
    { message: 'Invalid publicKeys signing key: ' + invalid }
  )
})

test('throws on non-integer quorum', async function ({ exception }) {
  exception(
    () => link({ publicKeys: PUBKEYS, namespace: 'test/app', quorum: 1.5 }),
    { message: 'Invalid quorum: 1.5' }
  )
})

test('throws on non-numeric quorum', async function ({ exception }) {
  exception(
    () => link({ publicKeys: PUBKEYS, namespace: 'test/app', quorum: '2' }),
    { message: 'Invalid quorum: 2' }
  )
})

test('throws on empty publicKeys', async function ({ exception }) {
  exception(() => link({ publicKeys: [], namespace: 'test/app', quorum: 2 }), {
    message: 'publicKeys required'
  })
})

test('throws on missing publicKeys', async function ({ exception }) {
  exception(() => link({ namespace: 'test/app', quorum: 2 }), {
    message: 'publicKeys required'
  })
})

test('throws when quorum exceeds signer count', async function ({ exception }) {
  exception(
    () =>
      link({
        publicKeys: PUBKEYS,
        namespace: 'test/app',
        quorum: PUBKEYS.length + 1
      }),
    {
      message:
        'Invalid quorum: ' +
        (PUBKEYS.length + 1) +
        ' is greater than ' +
        PUBKEYS.length +
        ' signing keys'
    }
  )
})

test('allows quorum equal to signer count', async function ({ ok }) {
  const result = link({
    publicKeys: PUBKEYS,
    namespace: 'test/app',
    quorum: PUBKEYS.length
  })
  ok(result.startsWith('pear://'))
})
