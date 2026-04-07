'use strict'
const plink = require('pear-link')
const HyperMultisig = require('hyper-multisig')
const Hyperdrive = require('hyperdrive')
const hs = require('hypercore-sign')
const z32 = require('z32')
const { ERR_INVALID_LINK, ERR_INVALID_INPUT } = require('pear-errors')
const createStore = require('./store')

module.exports = async function commit(
  config,
  sourceLink,
  reqZ32,
  responses = [],
  { dryRun = false, forceDangerous, peerUpdateTimeout, status } = {}
) {
  const { publicKeys, namespace, quorum } = config

  const raw = z32.decode(reqZ32)
  if (!hs.isRequest(raw)) throw ERR_INVALID_INPUT('Invalid request')
  for (const response of responses) {
    if (!hs.isResponse(z32.decode(response))) {
      throw ERR_INVALID_INPUT('Invalid response: ' + response)
    }
  }

  const parsed = plink.parse(sourceLink)
  if (parsed === null || parsed.drive.key === null) {
    throw ERR_INVALID_LINK('A valid source link must be specified', {
      sourceLink
    })
  }

  const { store, swarm, close } = await createStore()
  const multisig = new HyperMultisig(store, swarm)
  const srcDrive = new Hyperdrive(store, parsed.drive.key)
  const key = HyperMultisig.getCoreKey(publicKeys, namespace, { quorum })

  const multisigCore = store.get(key)
  await multisigCore.ready()
  swarm.join(multisigCore.discoveryKey, { client: true, server: false })
  await multisigCore.update()
  const firstCommit = multisigCore.length === 0
  await multisigCore.close()

  try {
    const runner = multisig.commitDrive(
      publicKeys,
      namespace,
      srcDrive,
      reqZ32,
      responses,
      {
        skipTargetChecks: firstCommit,
        force: forceDangerous,
        dryRun,
        peerUpdateTimeout,
        quorum
      }
    )

    if (status) {
      runner.on('verify-committable-start', (srcKey, dstKey) =>
        status('verify-committable-start', { srcKey, dstKey })
      )
      runner.on('commit-start', () => status('commit-start', {}))
      runner.on('verify-committed-start', (key) => {
        const link = plink.serialize({ drive: { key } })
        status('verify-committed-start', { firstCommit, key, link })
      })
    }

    const res = await runner.done()
    const dstKey = res.result.db.destCore.key
    const link = plink.serialize({ drive: { key: dstKey } })
    const verlink = plink.serialize({
      drive: {
        key: dstKey,
        length: res.result.db.destCore.length,
        fork: res.result.db.destCore.fork ?? 0
      }
    })

    return {
      dryRun,
      firstCommit,
      quorum: { total: res.manifest.quorum, obtained: res.quorum },
      link,
      verlink,
      result: res.result
    }
  } finally {
    await srcDrive.close()
    await close()
  }
}
