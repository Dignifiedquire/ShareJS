// Editing Context
// ===============

class Context {
  constructor(doc) {
    this._doc = doc

    const type = doc.type

    if (!type) {
      throw new Error(`Missing type ${this.collection} ${this.name}`)
    }

    if (!type.api) this.provides = {}

    // Copy everything else from the type's API into the editing context.
    for (var k in type.api) {
      this[k] = type.api[k]
    }
  }

  getSnapshot() {
    return this._doc.snapshot
  }

  submitOp(op, callback) {
    this._doc.submitOp(op, this, callback)
  }

  destroy() {
    if (this._doc.detach) {
      this._doc.detach()
      // Don't double-detach.
      delete this._doc.detach
    }
    // It will be removed from the actual editingContexts list next time
    // we receive an op on the document (and the list is iterated through).
    //
    // This is potentially dodgy, allowing a memory leak if you create &
    // destroy a whole bunch of contexts without receiving or sending any
    // ops to the document.
    //
    // NOTE Why can't we destroy contexts immediately?
    delete this._doc._onOp
    this._doc.remove = true
  }
}

export default Context
