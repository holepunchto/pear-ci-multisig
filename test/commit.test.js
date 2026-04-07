'use strict'
const test = require('brittle')
const sodium = require('sodium-native')
const hs = require('hypercore-sign')
const createTestnet = require('@hyperswarm/testnet')
const { request, commit } = require('..')
const {
  makeStore,
  makeKeypair,
  makeSrcDrive,
  hypercoreid,
  z32
} = require('./helpers/multisig')
const plink = require('pear-link')

const TEST_PASSWORD = 'test-password'

function makeKeypairWithPassword() {
  const pwd = sodium.sodium_malloc(Buffer.byteLength(TEST_PASSWORD))
  pwd.write(TEST_PASSWORD)
  return hs.generateKeys(pwd)
}

function makeConfig(publicKeys, namespace = 'test/commit') {
  return { publicKeys, namespace, quorum: publicKeys.length }
}

async function setup(t, testnet, namespace) {
  const { publicKey, secretKey } = makeKeypairWithPassword()
  const config = makeConfig(
    [hypercoreid.encode(publicKey)],
    namespace || 'test/commit-' + Math.random().toString(36).slice(2)
  )
  const bootstrap = testnet.nodes
  const seeder = await makeStore(bootstrap)
  const { srcDrive } = await makeSrcDrive(undefined, seeder.store)
  seeder.swarm.join(srcDrive.discoveryKey)
  await seeder.swarm.flush()
  const srcVerlink = plink.serialize({
    drive: {
      key: srcDrive.key,
      length: srcDrive.version,
      fork: srcDrive.core.fork ?? 0
    }
  })
  const sourceLink = plink.serialize({ drive: { key: srcDrive.key } })
  const reqZ32 = await request(config, srcVerlink, { force: true })
  const pwd = sodium.sodium_malloc(Buffer.byteLength(TEST_PASSWORD))
  pwd.write(TEST_PASSWORD)
  const response = z32.encode(hs.sign(z32.decode(reqZ32), secretKey, pwd))
  t.teardown(() => Promise.all([srcDrive.close(), seeder.close()]))
  return { config, sourceLink, reqZ32, responses: [response] }
}

async function withTestnet(t, fn) {
  const testnet = await createTestnet(3, t.teardown)
  const bootstrap = testnet.nodes.map((n) => `${n.host}:${n.port}`).join(',')
  const prev = process.env.HYPERSWARM_BOOTSTRAP
  process.env.HYPERSWARM_BOOTSTRAP = bootstrap
  t.teardown(() => {
    if (prev === undefined) delete process.env.HYPERSWARM_BOOTSTRAP
    else process.env.HYPERSWARM_BOOTSTRAP = prev
  })
  return fn(testnet)
}

test('commit: dryRun returns result without committing', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { config, sourceLink, reqZ32, responses } = await setup(t, testnet)

    const res = await commit(config, sourceLink, reqZ32, responses, {
      dryRun: true,
      forceDangerous: true
    })

    t.ok(res.dryRun, 'dryRun is true')
    t.ok(res.link.startsWith('pear://'), 'link is a pear link')
    t.ok(res.verlink.startsWith('pear://'), 'verlink is a pear link')
    t.ok(res.quorum.obtained >= 1, 'quorum obtained')
    t.is(res.quorum.total, 1, 'quorum total matches config')
  })
})

test('commit: returns link and verlink', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { config, sourceLink, reqZ32, responses } = await setup(t, testnet)

    const res = await commit(config, sourceLink, reqZ32, responses, {
      forceDangerous: true
    })

    t.is(res.dryRun, false, 'dryRun is false')
    t.ok(res.link.startsWith('pear://'), 'link is a pear link')
    t.ok(res.verlink.startsWith('pear://'), 'verlink is a pear link')
    t.ok(res.firstCommit, 'firstCommit is true for new drive')
  })
})

test('commit: link is deterministic for same config', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { config, sourceLink, reqZ32, responses } = await setup(t, testnet)

    const res1 = await commit(config, sourceLink, reqZ32, responses, {
      dryRun: true,
      forceDangerous: true
    })
    const res2 = await commit(config, sourceLink, reqZ32, responses, {
      dryRun: true,
      forceDangerous: true
    })

    t.is(res1.link, res2.link, 'same config produces same link')
  })
})

test('commit: throws on invalid request', async function (t) {
  const { publicKey } = makeKeypair()
  const config = makeConfig([hypercoreid.encode(publicKey)])
  const key = Buffer.alloc(32)
  const sourceLink = plink.serialize({ drive: { key } })

  await t.exception(
    commit(config, sourceLink, z32.encode(Buffer.from('notarequest')), []),
    /Invalid request/
  )
})

test('commit: throws on invalid source link', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { config, reqZ32, responses } = await setup(t, testnet)

    await t.exception(
      commit(config, 'not-a-link', reqZ32, responses),
      /valid source link/
    )
  })
})

test('commit: throws on invalid response', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { config, sourceLink, reqZ32 } = await setup(t, testnet)

    await t.exception(
      commit(config, sourceLink, reqZ32, [
        z32.encode(Buffer.from('badresponse'))
      ]),
      /Invalid response/
    )
  })
})
