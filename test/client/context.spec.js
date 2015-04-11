import Context from '../../lib/client/context'

describe('context', () => {

  describe('constructor', () => {
    it('throws on missing type', () => {
      expect(() => new Context({
        collection: 'people',
        name: 'alice'
      }))
      .to.throw('Missing type people/alice.')
    })

    it.skip('applies provided type api methods', () => {})
  })

  describe('snapshot', () => {
    it('returns the snapshot of the doc', () => {
      const ctx = new Context({
        type: 'text',
        collection: 'people',
        name: 'alice',
        snapshot: 'hello world'
      })

      expect(ctx.snapshot).to.be.eql('hello world')
    })
  })

  describe('submitOp', () => {
    it('calls submitOp on the doc', done => {
      const submitOp = sinon.stub().yields()
      const ctx = new Context({
        type: 'text',
        collection: 'people',
        name: 'alice',
        snapshot: '',
        submitOp: submitOp
      })
      const op = {op: ['hey']}

      ctx.submitOp(op, () => {
        expect(submitOp).to.have.been.calledWith(op)
        done()
      })
    })
  })

  describe('destroy', () => {
    let ctx

    beforeEach(() => {
      ctx = new Context({
        type: 'text',
        collection: 'people',
        name: 'alice',
        snapshot: ''
      })
    })

    it('removes _onOp', () => {
      ctx._onOp = sinon.stub()

      ctx.destroy()
      expect(ctx.onOp).to.be.undefined
    })

    it('calls detach', () => {
      ctx.detach = sinon.stub()

      ctx.destroy()
      expect(ctx.detach).to.have.been.called
    })

    it('does not call detach twice', () => {
      ctx.detach = sinon.stub()

      ctx.destroy()
      ctx.destroy()

      expect(ctx.detach).to.have.been.calledOnce
    })
  })
})
