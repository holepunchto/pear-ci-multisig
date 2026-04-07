'use strict'
const path = require('path')
const os = require('os')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const program = global.Bare ?? global.process
module.exports = async function createStore() {
  const dir = path.join(os.tmpdir(), 'pear-multisig-' + program.pid)
  const store = new Corestore(dir)
  const bootstrap = program.env.HYPERSWARM_BOOTSTRAP
    ? program.env.HYPERSWARM_BOOTSTRAP.split(',').map((addr) => {
        const [host, port] = addr.split(':')
        return { host, port: Number(port) }
      })
    : undefined
  const swarm = new Hyperswarm(bootstrap ? { bootstrap } : {})
  swarm.on('connection', (conn) => {
    try {
      store.replicate(conn)
    } catch {}
  })
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
