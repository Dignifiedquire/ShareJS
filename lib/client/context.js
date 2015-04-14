// Editing Context
// ===============

import {EventEmitter} from 'events'

// Private Symbols
// ---------------

const _REMOVE = Symbol('remove')

class Context extends EventEmitter {
  constructor(doc) {
    super()

    this._doc = doc
    this[_REMOVE] = false
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
    this[_REMOVE] = true
  }
}

export default Context
