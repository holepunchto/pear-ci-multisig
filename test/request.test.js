'use strict'
const test = require('brittle')
const createTestnet = require('@hyperswarm/testnet')
const { request } = require('..')
const {
  makeStore,
  makeKeypair,
  makeSrcDrive,
  hypercoreid,
  z32
} = require('./helpers/multisig')
const hs = require('hypercore-sign')
const plink = require('pear-link')

function makeConfig(publicKeys) {
  return { publicKeys, namespace: 'test/request', quorum: 1 }
}

function verlink(srcDrive) {
  return plink.serialize({
    drive: {
      key: srcDrive.key,
      length: srcDrive.version,
      fork: srcDrive.core.fork ?? 0
    }
  })
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

test('request: returns a z32 string', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { publicKey } = makeKeypair()
    const config = makeConfig([hypercoreid.encode(publicKey)])
    const bootstrap = testnet.nodes
    const seeder = await makeStore(bootstrap)
    const { srcDrive } = await makeSrcDrive(undefined, seeder.store)
    seeder.swarm.join(srcDrive.discoveryKey)
    await seeder.swarm.flush()
    t.teardown(() => Promise.all([srcDrive.close(), seeder.close()]))

    const reqZ32 = await request(config, verlink(srcDrive), { force: true })

    t.ok(typeof reqZ32 === 'string', 'result is a string')
    t.ok(reqZ32.length > 0, 'result is non-empty')
  })
})

test('request: result is a valid signing request', async function (t) {
  await withTestnet(t, async (testnet) => {
    const { publicKey } = makeKeypair()
    const config = makeConfig([hypercoreid.encode(publicKey)])
    const bootstrap = testnet.nodes
    const seeder = await makeStore(bootstrap)
    const { srcDrive } = await makeSrcDrive(undefined, seeder.store)
    seeder.swarm.join(srcDrive.discoveryKey)
    await seeder.swarm.flush()
    t.teardown(() => Promise.all([srcDrive.close(), seeder.close()]))

    const reqZ32 = await request(config, verlink(srcDrive), { force: true })

    t.ok(
      hs.isRequest(z32.decode(reqZ32)),
      'result decodes as a valid signing request'
    )
  })
})

test('request: throws on non-versioned link (no length)', async function (t) {
  const { publicKey } = makeKeypair()
  const config = makeConfig([hypercoreid.encode(publicKey)])
  const key = Buffer.alloc(32).fill(1)

  await t.exception(
    request(config, plink.serialize({ drive: { key } })),
    /valid versioned source link/
  )
})

test('request: throws on invalid link', async function (t) {
  const { publicKey } = makeKeypair()
  const config = makeConfig([hypercoreid.encode(publicKey)])

  await t.exception(
    request(config, 'not-a-link'),
    /valid versioned source link/
  )
})
