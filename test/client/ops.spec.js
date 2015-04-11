import * as ops from '../../lib/client/ops'

describe('ops', () => {
  describe('setNoOp', () => {
    it('removes op, create and del keys', () => {
      let myOp = {
        op: 'hello',
        create: 'what',
        del: 4
      }
      ops.setNoOp(myOp)
      expect(myOp).to.be.eql({})
    })
  })

  describe('isNoOp', () => {
    it('handles a noOp', () => {
      const myOp = {}

      expect(ops.isNoOp(myOp)).to.be.eql(true)
    })
    it('handles a non noOp', () => {
      const myOp = {
        create: 'yes'
      }

      expect(ops.isNoOp(myOp)).to.be.eql(false)
    })
  })

  describe('tryCompose', () => {
    describe('combines', () => {
      it.skip('create + del', () => {

      })

      it.skip('create + op', () => {

      })

      it.skip('noOp + op', () => {

      })

      it.skip('op + op (composable)', () => {

      })
    })
    describe('does not combine', () => {
      it('op + op (non composable)', () => {
        let type = {compose: false}
        let op1 = {op: ['hello']}
        let op2 = {op: [' world']}

        expect(ops.tryCompose(type, op1, op2)).to.be.eql(false)
      })
    })
  })
})
