// Editing Context
// ===============

// Private Symbols
// ---------------

const _REMOVE = Symbol('remove')

class Context {
  constructor(doc) {
    this._doc = doc
    this[_REMOVE] = false

    const type = doc.type

    if (!type) {
      throw new Error(`Missing type ${doc.collection}/${doc.name}.`)
    }

    if (!type.api) this.provides = {}

    // Copy everything else from the type's API into the editing context.
    for (let k in type.api) {
      this[k] = type.api[k]
    }
  }

  get snapshot() {
    return this._doc.snapshot
  }

  shouldRemove() {
    return this[_REMOVE]
  }

  submitOp(op, callback) {
    this._doc.submitOp(op, this, callback)
  }

  destroy() {
    if (this.detach && !this[_REMOVE]) {
      this.detach()
    }
    // It will be removed from the actual editingContexts list next time
    // we receive an op on the document (and the list is iterated through).
    //
    // This is potentially dodgy, allowing a memory leak if you create &
    // destroy a whole bunch of contexts without receiving or sending any
    // ops to the document.
    //
    // NOTE Why can't we destroy contexts immediately?
    delete this._onOp
    this[_REMOVE] = true
  }
}

export default Context
