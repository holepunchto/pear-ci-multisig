'use strict'
const plink = require('pear-link')
const HyperMultisig = require('hyper-multisig')
const Hyperdrive = require('hyperdrive')
const z32 = require('z32')
const { ERR_INVALID_LINK } = require('pear-errors')
const createStore = require('./store')

module.exports = async function request(
  config,
  verlink,
  { force, peerUpdateTimeout } = {}
) {
  const { publicKeys, namespace, quorum } = config

  const parsed = plink.parse(verlink)
  if (
    parsed === null ||
    parsed.drive.key === null ||
    parsed.drive.length === null
  ) {
    throw ERR_INVALID_LINK('A valid versioned source link must be specified', {
      verlink
    })
  }

  const { store, swarm, close } = await createStore()
  const multisig = new HyperMultisig(store, swarm)
  const srcDrive = new Hyperdrive(store, parsed.drive.key)

  try {
    const runner = multisig.requestDrive(
      publicKeys,
      namespace,
      srcDrive,
      parsed.drive.length,
      {
        force,
        peerUpdateTimeout,
        quorum
      }
    )
    const res = await runner.done()
    return z32.encode(res.request)
  } finally {
    await srcDrive.close()
    await close()
  }
}
