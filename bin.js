#!/usr/bin/env node
'use strict'
const fs = require('fs')
const { ERR_INVALID_CONFIG, ERR_INVALID_INPUT } = require('pear-errors')
const { command, description, flag, arg, bail } = require('paparam')
const loadConfig = require('./lib/config')
const ci = require('.')
const program = global.Bare ?? global.process

const link = command(
  'link',
  description`Print the multisig pear link from config or positional args`,
  flag('--config <path>', 'Path to pear.json config file'),
  flag('--quorum <n>', 'Number of required signers'),
  flag('--namespace <ns>', 'Multisig namespace'),
  flag('--pubkey <key>', 'Public key of a signer (repeatable)').multiple(),
  (cmd) => {
    const { quorum, namespace, pubkey, config } = cmd.flags
    const hasFlags =
      quorum !== undefined || namespace !== undefined || pubkey !== undefined
    if (hasFlags && config) {
      throw ERR_INVALID_INPUT(
        '--config cannot be combined with --quorum/--namespace/--pubkey'
      )
    }
    let multisig
    if (hasFlags) {
      multisig = loadConfig(null, { quorum, namespace, pubkey })
    } else {
      const configPath = config || 'pear.json'
      multisig = JSON.parse(fs.readFileSync(configPath)).multisig
      if (!multisig) throw ERR_INVALID_CONFIG('multisig field required')
      if (!multisig.namespace) throw ERR_INVALID_CONFIG('namespace required')
      if (!multisig.quorum) throw ERR_INVALID_CONFIG('quorum required')
      if (!multisig.publicKeys || multisig.publicKeys.length === 0) {
        throw ERR_INVALID_CONFIG('publicKeys required')
      }
    }
    console.log(ci.link(multisig))
  },
  bail(onbail)
)

const request = command(
  'request',
  description`Create a signing request from a versioned source link`,
  flag('--config <path>', 'Path to pear.json config file'),
  flag('--quorum <n>', 'Number of required signers'),
  flag('--namespace <ns>', 'Multisig namespace'),
  flag('--pubkey <key>', 'Public key of a signer (repeatable)').multiple(),
  flag('--force', 'Skip requestability checks'),
  flag('--peer-update-timeout <ms>', 'Timeout for peer updates'),
  arg('<verlink>', 'Versioned source pear link'),
  async (cmd) => {
    const config = getConfig(cmd)
    const result = await ci.request(config, cmd.args.verlink, {
      force: cmd.flags.force,
      peerUpdateTimeout: cmd.flags.peerUpdateTimeout
    })
    console.log(result)
  },
  bail(onbail)
)

const cmd = command('pear-multisig', link, request, bail(onbail))

cmd.parse(program.argv.slice(2))

function onbail(b) {
  if (
    b.err &&
    (b.err.code === 'ERR_INVALID_CONFIG' ||
      b.err.code === 'ERR_INVALID_INPUT' ||
      b.err.code === 'ERR_INVALID_LINK')
  ) {
    console.error(b.err.message)
  } else {
    console.error(b.reason)
  }
  program.exit(1)
}

function getConfig(cmd) {
  const { quorum, namespace, pubkey, config } = cmd.flags
  const hasFlags =
    quorum !== undefined || namespace !== undefined || pubkey !== undefined
  if (hasFlags && config) {
    throw ERR_INVALID_INPUT(
      '--config cannot be combined with --quorum/--namespace/--pubkey'
    )
  }
  return loadConfig(config || 'pear.json', { quorum, namespace, pubkey })
}
