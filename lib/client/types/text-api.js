// Text document API for the 'text' type.

// The API implements the standard text API methods. In particular:
//
// - getLength() returns the length of the document in characters
// - getText() returns a string of the document
// - insert(pos, text, [callback]) inserts text at position pos in the document
// - remove(pos, length, [callback]) removes length characters at position pos
//
// Events are implemented by just adding the appropriate methods to your
// context object.
// onInsert(pos, text): Called when text is inserted.
// onRemove(pos, length): Called when text is removed.

import Context from '../context'

class Text extends Context {

  static uri = 'http://sharejs.org/types/textv1'

  static provides = {text: true}

  // Returns the number of characters in the string
  getLength() {
    return this.getSnapshot()
  }

  // Returns the text content of the document
  get() {
    return this.getSnapshot()
  }

  // Insert the specified text at the given position in the document
  insert(pos, text, callback) {
    return this.submitOp([pos, text], callback)
  }

  remove(pos, length, callback) {
    return this.submitOp([pos, {d: length}], callback)
  }

  // When you use this API, you should add event listeners
  // on your context for
  // * 'on insert': (pos, text)
  // * 'on remove': (pos, removedLength)
  _onOp(op) {
    if (this.shouldRemove) return

    let pos = 0
    let spos = 0

    op.forEach(component => {
      switch (typeof component) {
      case 'number':
        pos += component
        spos += component
        break
      case 'string':
        this.emit('on insert', pos, component)
        pos += component.length
        break
      case 'object':
        this.emit('on remove', pos, component.d)
        spos += component.d
      }
    })
  }
}

export default Text
