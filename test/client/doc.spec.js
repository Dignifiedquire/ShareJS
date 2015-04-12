import {EventEmitter} from 'events'

import {Doc} from '../../lib/client'

describe('doc', () => {
  let connection
  describe('public api', () => {
    beforeEach(() => {
      connection = {
        _destroyDoc: sinon.stub()
      }
    })

    describe('constructor', () => {
      it('inherits from EventEmitter', () => {
        const doc = new Doc({}, 'people', 'alice')

        expect(doc).to.be.an.instanceOf(EventEmitter)
      })

      it('assigns the properties', () => {
        const doc = new Doc(connection, 'people', 'alice')

        expect(doc).to.have.property('connection', connection)
        expect(doc).to.have.property('collection', 'people')
        expect(doc).to.have.property('name', 'alice')
      })
    })

    describe('ingestData', done => {
      let doc

      beforeEach(() => {
        doc = new Doc(connection, 'people', 'alice')
      })

      it('applies the data to the doc', () => {
        const ready = sinon.stub()
        doc.on('ready', ready)

        doc.ingestData({
          v: 12,
          data: 'hello world',
          type: 'text'
        })

        expect(doc).to.have.property('version', 12)
        expect(doc).to.have.property('snapshot', 'hello world')
        expect(doc).to.have.property('state', 'ready')
        expect(ready).to.have.been.calledOnce
      })

      it('throws an error when missing the version', () => {
        expect(() => {
          doc.ingestData({})
        }).to.throw('Missing version in ingested data people alice.')
      })

      it('ignores the data if the state is already set', () => {
        doc.state = 'floating'

        doc.ingestData({
          v: 12,
          data: 'hello world',
          type: 'text'
        })

        expect(doc).to.have.property('version', null)
        expect(doc).to.have.property('snapshot', undefined)
        expect(doc).to.have.property('state', 'floating')
      })

      it('ignores newer versions', () => {
        doc.version = 13
        doc.state = 'ready'

        doc.ingestData({
          v: 12,
          data: 'hello world',
          type: 'text'
        })

        expect(doc).to.have.property('version', 13)
      })
    })

    describe('getSnapshot', () => {
      it('returns the current snapshot', () => {
        const doc = new Doc(connection, 'people', 'alice')
        doc.snapshot = 'hello world'

        expect(doc.getSnapshot()).to.be.eql('hello world')
      })
    })

    describe('whenReady', () => {

    })

    describe('retry', () => {

    })

    describe('hasPending', () => {

    })

    describe('flush', () => {

    })

    describe('subscribe', () => {

    })

    describe('unsubscribe', () => {

    })

    describe('fetch', () => {

    })

    describe('submitOp', () => {

    })

    describe('create', () => {

    })

    describe('del', () => {

    })

    describe('createContext', () => {

    })

    describe('pause', () => {

    })

    describe('resume', () => {

    })

    describe('destroy', () => {
      let doc
      beforeEach(() => {
        doc = new Doc(connection, 'people', 'alice')
      })

      afterEach(() => {
        connection._destroyDoc.reset()
      })

      it('destroys the remote doc', done => {
        doc.destroy(() => {
          expect(connection._destroyDoc).to.have.been.calledWith(doc)
          done()
        })
      })

      it('removes all contexts', done => {
        sinon.spy(doc, 'removeContexts')
        doc.destroy(() => {
          expect(doc.removeContexts).to.have.been.calledOnce
          done()
        })
      })

      it('waits for nothing pending to destroy the doc', done => {
        doc.action = 'subscribe'
        sinon.spy(doc, 'emit')

        doc._clearAction()

        doc.destroy(() => {
          expect(doc.emit).to.have.been.calledBefore(connection._destroyDoc)
          expect(doc.hasPending()).to.be.eql(false)
          done()
        })
      })
    })

    describe('removeContexts', () => {

    })
  })
})
