'use strict'
const fs = require('fs')
const { ERR_INVALID_INPUT, ERR_INVALID_CONFIG } = require('pear-errors')

module.exports = function loadConfig(
  configPath,
  { quorum, namespace, pubkey } = {}
) {
  const hasFlags =
    quorum !== undefined || namespace !== undefined || pubkey !== undefined
  if (hasFlags) {
    if (
      quorum === undefined ||
      namespace === undefined ||
      pubkey === undefined
    ) {
      throw ERR_INVALID_INPUT(
        '--quorum, --namespace and --pubkey must all be specified together'
      )
    }
    return { quorum: Number(quorum), namespace, publicKeys: pubkey }
  }

  let raw
  try {
    raw = JSON.parse(fs.readFileSync(configPath))
  } catch (err) {
    const invalidPath =
      err.code === 'ENOENT' ||
      err.code === 'EACCES' ||
      err.code === 'EPERM' ||
      err.code === 'ENOTDIR' ||
      err.code === 'EMFILE' ||
      err.code === 'ENFILE'
    if (invalidPath) throw ERR_INVALID_INPUT(err.message)
    throw ERR_INVALID_CONFIG(
      'Could not parse config ' + configPath + ': ' + err.message
    )
  }
  const config = raw.multisig || raw
  if (!config.publicKeys || config.publicKeys.length === 0) {
    throw ERR_INVALID_CONFIG('multisig.publicKeys required in ' + configPath)
  }
  if (!config.quorum) {
    throw ERR_INVALID_CONFIG('multisig.quorum required in ' + configPath)
  }
  if (!config.namespace) {
    throw ERR_INVALID_CONFIG('multisig.namespace required in ' + configPath)
  }
  return config
}
