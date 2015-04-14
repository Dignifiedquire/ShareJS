// Text document API for text-tp2

import types from 'ottypes'

import Context from '../context'

const uri = 'http://sharejs.org/types/text-tp2v1'

const type = types[uri]
const takeDoc = type._takeDoc
const append = type._append

const appendSkipChars = (op, doc, pos, maxlength) => {
  while ((maxlength == null || maxlength > 0) && pos.index < doc.data.length) {
    const part = takeDoc(doc, pos, maxlength, true)

    if (maxlength != null && typeof part === 'string') {
      maxlength -= part.length
    }
    append(op, part.length || part)
  }
}

class Text2 extends Context {
  static uri = uri

  static provides = {text: true}

  // Number of characters in the string
  getLength() {
    return this.getSnapshot().charLength
  }

  // Flatten the document into a string
  get() {
    return this.getSnapshot().filter(elem => {
      return typeof elem === 'string'
    }).join('')
  }

  // Insert text at pos
  insert(pos = 0, text, callback) {
    const op = []
    const docPos = {index: 0, offset: 0}
    const snapshot = this.getSnapshot()

    // Skip to the specified position
    appendSkipChars(op, snapshot, docPos, pos)

    // Append the text
    append(op, {i: text})
    appendSkipChars(op, snapshot, docPos)
    this.submitOp(op, callback)

    return op
  }

  // Remove length of text at pos
  remove(pos, len, callback) {
    const op = []
    const docPos = {index: 0, offset: 0}
    const snapshot = this.getSnapshot()

    // Skip to the position
    appendSkipChars(op, snapshot, docPos, pos)

    while (len > 0) {
      const part = takeDoc(snapshot, docPos, len, true)

      // We only need to delete actual characters. This should also be valid if
      // we deleted all the tombstones in the document here.
      if (typeof part === 'string') {
        append(op, {d: part.length})
        len -= part.length
      } else {
        append(op, part)
      }
    }

    appendSkipChars(op, snapshot, docPos)
    this.submitOp(op, callback)
    return op
  }

  _beforeOp() {
    // Its a shame we need this. This also currently relies on snapshots being
    // cloned during apply(). This is used in _onOp below to figure out what
    // text was _actually_ inserted and removed.
    //
    // Maybe instead we should do all the _onOp logic here and store the result
    // then play the events when _onOp is actually called or something.
    this.__prevSnapshot = this.getSnapshot()
  }

  _onOp(op) {
    let textPos = 0
    const docPos = {index: 0, offset: 0}

    // The snapshot we get here is the document state _AFTER_ the specified op
    // has been applied. That means any deleted characters are now tombstones.
    const prevSnapshot = this.__prevSnapshot

    op.forEach(component => {
      let part
      let remainder

      if (typeof component === 'number') {
        // Skip
        for (remainder = component;
             remainder > 0;
             remainder -= part.length || part) {

          part = takeDoc(prevSnapshot, docPos, remainder)
          if (typeof part === 'string') {
            textPos += part.length
          }
        }
      } else if (component.i != null) {
        // Insert
        if (typeof component.i === 'string') {
          // ... and its an insert of text, not insert of tombstones
          if (this.onInsert) this.onInsert(textPos, component.i)
          textPos += component.i.length
        }
      } else {
        // Delete
        for (remainder = component.d;
             remainder > 0;
             remainder -= part.length || part) {

          part = takeDoc(prevSnapshot, docPos, remainder)
          if (typeof part === 'string' && this.onRemove) {
            this.onRemove(textPos, part.length)
          }
        }
      }
    })
  }
}

export default Text2
