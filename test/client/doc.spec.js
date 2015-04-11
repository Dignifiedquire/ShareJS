import {EventEmitter} from 'events'

import Doc from '../../lib/client/doc'

describe('doc', () => {
  let connection

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
  })
})
