'use strict'

const path = require('path')
const AccessController = require('./access-controller')

class OrbitDBAccessController extends AccessController {
  constructor (orbitdb) {
    super()
    this._orbitdb = orbitdb
    this._db = null
  }

  async load (address) {
    const addr = path.join(address, '/_access')

    // Create a key-value database that the creator can write to
    this._db = await this._orbitdb.keyvalue(addr, {
      write: [this._orbitdb.key.getPublic('hex')],
      replicate: false, // TODO: remove
    })

    // Get values from the database
    this._access = {
      admin: this._db.get('admin') || [],
      read: this._db.get('read') || [],
      write: this._db.get('write') || [],
    }
  }

  async save () {
    if (!this._db) {
      this._db = await this._orbitdb.keyvalue(addr, {
        write: [this._orbitdb.key.getPublic('hex')],
        replicate: false, // TODO: remove
      })
    }

    return Promise.resolve(this._db.address.toString())
  }

  /* Public Methods */
  async add (accessLevel, key) {
    if(!Object.keys(this._access).includes(accessLevel))
      throw new Error(`Unknown access level: ${accessLevel}`)

    if (!this._access[accessLevel].includes(key)) {
      let accessKeys = new Set(this._db.get(accessLevel))
      accessKeys.add(key)
      await this._db.put(accessLevel, Array.from(accessKeys))
      this._access[accessLevel] = this._db.get(accessLevel)
    }
  }
}

module.exports = OrbitDBAccessController
