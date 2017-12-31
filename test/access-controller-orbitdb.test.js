'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const rmrf = require('rimraf')
const mapSeries = require('p-map-series')
const levelup = require('levelup')
const leveldown = require('leveldown')
const OrbitDB = require('../src/OrbitDB')
const OrbitDBAddress = require('../src/orbit-db-address')
const OrbitDBAccessController = require('../src/orbitdb-access-controller')
const config = require('./utils/config')
const startIpfs = require('./utils/start-ipfs')

const dbPath = './orbitdb/tests/create-open'
const ipfsPath = './orbitdb/tests/create-open/ipfs'

describe.only('orbit-db - Access Controller (OrbitDB)', function() {
  this.timeout(config.timeout)

  let ipfs, orbitdb, db, address
  let localDataPath

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(dbPath)
    ipfs = await startIpfs(config.daemon1)
    orbitdb = new OrbitDB(ipfs, dbPath)
  })

  after(async () => {
    if(orbitdb) 
      await orbitdb.stop()

    if (ipfs)
      await ipfs.stop()
  })

  describe.only('Access Controller', function() {
    describe('Constructor', function() {
      let accessController
      
      before(() => {
        accessController = new OrbitDBAccessController(ipfs)
      })

      it('creates an access controller', () => {
        assert.notEqual(accessController, null)
      })

      it('has IPFS instance', async () => {
        assert.equal(accessController._ipfs._peerInfo.id._idB58String, ipfs._peerInfo.id._idB58String)
      })

      it('sets default access', async () => {
        assert.deepEqual(accessController._access, { 
          admin: [], 
          write: [],  
          read: [],
        })
      })
    })

    describe.only('load', function() {
      let accessController
      
      before(() => {
        accessController = new OrbitDBAccessController(orbitdb)
      })

      it('loads access database', async () => {
        const dbName = 'database-' + new Date().getTime()
        await accessController.load(dbName)

        // Check address
        const addr = accessController._db.address.toString().split('/')
        assert.equal(addr[addr.length - 1], '_access')
        assert.equal(addr[addr.length - 2], dbName)

        // Check write access
        assert.deepEqual(accessController._db.access._access, { 
          admin: [], 
          read: [],
          write: [orbitdb.key.getPublic('hex')],
        })

        // Check that access table was initialized as empty
        assert.deepEqual(accessController._access, { 
          admin: [], 
          read: [],
          write: [],
        })

        // Add a key
        await accessController.add('write', orbitdb.key.getPublic('hex'))
        assert.deepEqual(accessController._access, { 
          admin: [], 
          read: [],
          write: [
            orbitdb.key.getPublic('hex')
          ],
        })

        // Add another key
        await accessController.add('write', 'XYZ')
        assert.deepEqual(accessController._access, { 
          admin: [], 
          read: [],
          write: [
            orbitdb.key.getPublic('hex'), 
            'XYZ'
          ],
        })

        // Make sure the different access levels are accessible via properties
        assert.deepEqual(accessController.admin, [])
        assert.deepEqual(accessController.read, [])
        assert.deepEqual(accessController.write, [orbitdb.key.getPublic('hex'), 'XYZ'])

        // Save
        const address = await accessController.save()
        const addr2 = address.split('/')
        assert.equal(addr[addr2.length - 1], '_access')
        assert.equal(addr[addr2.length - 2], dbName)
      })
    })

    it('saves database manifest file locally', async () => {
      db = await orbitdb.create('AABB', 'feed', { replicate: false })
      const dag = await ipfs.object.get(db.address.root)
      const manifest = JSON.parse(dag.toJSON().data)
      assert.notEqual(manifest, )
      assert.equal(manifest.name, 'AABB')
      assert.equal(manifest.type, 'feed')
      assert.notEqual(manifest.accessController, null)
      assert.equal(manifest.accessController.indexOf('/orbitdb'), 0)
    })

    it('creates an access controller and adds ourselves as writer by default', async () => {
      db = await orbitdb.create('fourth', 'feed')
      assert.deepEqual(db.access.write, [orbitdb.key.getPublic('hex')])
    })

    it('creates an access controller and adds writers', async () => {
      db = await orbitdb.create('fourth', 'feed', { write: ['another-key', 'yet-another-key', orbitdb.key.getPublic('hex')] })
      assert.deepEqual(db.access.write, ['another-key', 'yet-another-key', orbitdb.key.getPublic('hex')])
    })

    it('creates an access controller and doesn\'t add an admin', async () => {
      db = await orbitdb.create('sixth', 'feed')
      assert.deepEqual(db.access.admin, [])
    })

    it('creates an access controller and doesn\'t add read access keys', async () => {
      db = await orbitdb.create('seventh', 'feed', { read: ['one', 'two'] })
      assert.deepEqual(db.access.read, [])
    })
  })
})
