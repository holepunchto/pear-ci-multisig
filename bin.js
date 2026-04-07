#!/usr/bin/env node
'use strict'
const fs = require('fs')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_CONFIG, ERR_INVALID_INPUT } = require('pear-errors')
const { command, description, flag, arg, rest, bail } = require('paparam')
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

const verify = command(
  'verify',
  description`Dry-run commit to validate signatures`,
  flag('--config <path>', 'Path to pear.json config file'),
  flag('--quorum <n>', 'Number of required signers'),
  flag('--namespace <ns>', 'Multisig namespace'),
  flag('--pubkey <key>', 'Public key of a signer (repeatable)').multiple(),
  flag('--force-dangerous', 'Skip safety checks'),
  flag('--peer-update-timeout <ms>', 'Timeout for peer updates'),
  arg('<source-link>', 'Source pear link'),
  arg('<req>', 'z32-encoded signing request'),
  rest('[responses...]', 'z32-encoded responses from signers'),
  (cmd) => comitter(cmd, true),
  bail(onbail)
)

const commit = command(
  'commit',
  description`Commit signed changes to the multisig drive`,
  flag('--config <path>', 'Path to pear.json config file'),
  flag('--quorum <n>', 'Number of required signers'),
  flag('--namespace <ns>', 'Multisig namespace'),
  flag('--pubkey <key>', 'Public key of a signer (repeatable)').multiple(),
  flag('--force-dangerous', 'Skip safety checks'),
  flag('--peer-update-timeout <ms>', 'Timeout for peer updates'),
  arg('<source-link>', 'Source pear link'),
  arg('<req>', 'z32-encoded signing request'),
  rest('[responses...]', 'z32-encoded responses from signers'),
  comitter,
  bail(onbail)
)

function status(event, data) {
  if (event === 'verify-committable-start') {
    console.error(
      'Verifying safe to commit (source ' +
        hypercoreid.encode(data.srcKey) +
        ' to multisig target ' +
        hypercoreid.encode(data.dstKey) +
        ')'
    )
  } else if (event === 'commit-start') {
    console.error('Committing...')
  } else if (event === 'verify-committed-start') {
    console.error(
      'Committed (key ' +
        hypercoreid.encode(data.key) +
        ')\nWaiting for remote seeders to pick up the changes...'
    )
    if (data.firstCommit) {
      console.error(
        'Make sure ' +
          data.link +
          ' is seeded. Once seeded process will continue. Do not exit until seeding confirmed'
      )
    }
  }
}

async function comitter(cmd, dryRun = false) {
  const config = getConfig(cmd)
  const res = await ci.commit(
    config,
    cmd.args.sourceLink,
    cmd.args.req,
    cmd.rest,
    {
      dryRun,
      forceDangerous: cmd.flags.forceDangerous,
      peerUpdateTimeout: cmd.flags.peerUpdateTimeout,
      status
    }
  )
  console.log('\nQuorum: ' + res.quorum.obtained + ' / ' + res.quorum.total)
  if (res.dryRun) console.log('Dry-run: OK')
  console.log('link: ' + res.link)
  console.log('verlink: ' + res.verlink)
  console.log('seed: pear seed ' + res.link)
}

const cmd = command(
  'pear-multisig',
  link,
  request,
  verify,
  commit,
  bail(onbail)
)

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
