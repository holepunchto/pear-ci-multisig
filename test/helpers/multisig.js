'use strict'
const os = require('os')
const path = require('path')
const fs = require('fs')
const sodium = require('sodium-native')
const z32 = require('z32')
const hypercoreid = require('hypercore-id-encoding')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const HyperMultisig = require('hyper-multisig')
const Hyperdrive = require('hyperdrive')

function tmpDir() {
  return path.join(
    os.tmpdir(),
    'pear-ci-multisig-test-' + Math.random().toString(36).slice(2)
  )
}

async function makeStore(bootstrap) {
  const store = new Corestore(tmpDir())
  const swarm = new Hyperswarm(bootstrap ? { bootstrap } : {})
  swarm.on('connection', (conn) => store.replicate(conn))
  await store.ready()
  return {
    store,
    swarm,
    async close() {
      await swarm.destroy()
      await store.close()
    }
  }
}

function makeKeypair() {
  const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
  const secretKey = sodium.sodium_malloc(sodium.crypto_sign_SECRETKEYBYTES)
  sodium.crypto_sign_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

function writeSecretKey(secretKey) {
  const dir = tmpDir()
  fs.mkdirSync(dir, { recursive: true })
  const keyPath = path.join(dir, 'secret')
  fs.writeFileSync(keyPath, secretKey)
  return keyPath
}

async function makeSrcDrive(
  content = { '/test': Buffer.from('hello') },
  store = null
) {
  const srcStore = store || new Corestore(tmpDir())
  if (!store) await srcStore.ready()
  const srcDrive = new Hyperdrive(srcStore)
  await srcDrive.ready()
  await srcDrive.getBlobs()
  for (const [key, val] of Object.entries(content)) {
    await srcDrive.put(key, val)
  }
  return { srcDrive, srcStore, ownStore: !store }
}

async function makeRequest(config) {
  const { store, swarm, close } = await makeStore()
  const { publicKeys, namespace, quorum } = config
  const { srcDrive, srcStore } = await makeSrcDrive()

  const multisig = new HyperMultisig(store, swarm)
  const runner = multisig.requestDrive(
    publicKeys,
    namespace,
    srcDrive,
    srcDrive.version,
    { quorum, force: true }
  )
  const res = await runner.done()

  await srcDrive.close()
  await srcStore.close()
  await close()

  return { reqZ32: z32.encode(res.request), srcDrive }
}

function writeConfig(config, dir) {
  fs.mkdirSync(dir, { recursive: true })
  const configPath = path.join(dir, 'pear.json')
  fs.writeFileSync(configPath, JSON.stringify({ multisig: config }))
  return configPath
}

module.exports = {
  tmpDir,
  makeStore,
  makeKeypair,
  writeSecretKey,
  makeSrcDrive,
  makeRequest,
  writeConfig,
  hypercoreid,
  z32
}
