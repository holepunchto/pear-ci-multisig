'use strict'
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const hypercoreid = require('hypercore-id-encoding')
const HyperMultisig = require('hyper-multisig')

module.exports = function link(config) {
  const { publicKeys, namespace, quorum } = config
  if (!namespace) {
    throw ERR_INVALID_INPUT('namespace required')
  }
  if (!publicKeys || publicKeys.length === 0) {
    throw ERR_INVALID_INPUT('publicKeys required')
  }
  for (const publicKey of publicKeys) {
    if (hypercoreid.isValid(publicKey) === false) {
      throw ERR_INVALID_INPUT('Invalid publicKeys signing key: ' + publicKey)
    }
  }
  if (Number.isInteger(quorum) === false) {
    throw ERR_INVALID_INPUT('Invalid quorum: ' + quorum)
  }
  if (quorum > publicKeys.length) {
    throw ERR_INVALID_INPUT(
      'Invalid quorum: ' +
        quorum +
        ' is greater than ' +
        publicKeys.length +
        ' signing keys'
    )
  }
  const key = HyperMultisig.getCoreKey(publicKeys, namespace, { quorum })
  return plink.serialize({ drive: { key } })
}
