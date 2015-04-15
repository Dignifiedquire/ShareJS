// JSON document API for the 'json0' type.

import types from 'ottypes'

import Context from '../context'

const uri = 'http://sharejs.org/types/JSONv0'
const type = types[uri]

// Helpers
function depath(path) {
  if (path.length === 1 && path[0].constructor === Array) {
    return path[0]
  } else {
    return path
  }
}

function traverse(snapshot, path) {
  let key = 'data'
  let elem = { data: snapshot }

  path.forEach(segment => {
    elem = elem[key]
    key = segment

    if (typeof elem === 'undefined') {
      throw new Error('bad path')
    }
  })

  return {elem, key }
}

function pathEquals(p1, p2) {
  if (p1.length !== p2.length) {
    return false
  }
  for (let i = 0; i < p1.length; ++i) {
    if (p1[i] !== p2[i]) {
      return false
    }
  }
  return true
}

function containsPath(p1, p2) {
  if (p1.length < p2.length) return false
  return pathEquals(p1.slice(0, p2.length), p2)
}

// Given a path represented as an array or a number, normalize to an array
// whole numbers are converted to integers.
function normalizePath(path) {
  if (Array.isArray(path)) return path

  if (typeof path === 'number') return [path]

  throw new Error('Path is not normalizable.')
}

// SubDoc
// this object is returned from context.createContextAt()
class SubDoc {
  constructor(context, path = []) {
    this.context = context
    this.path = path
  }

  _updatePath(op) {
    op.forEach(({lm, p}) => {
      if (lm !== undefined && containsPath(this.path, p)) {
        const prefix = p.slice(0, p.length-1)

        prefix.push(lm)
        this.path = prefix.concat(this.path.slice(prefix.length))
      }
    })
  }

  prefixPath(path) {
    return this.path.concat(normalizePath(path))
  }

  createContextAt(...path) {
    return this.context.createContextAt(this.path.concat(depath(path)))
  }

  get(path) {
    return this.context.get(this.prefixPath(path))
  }

  set(path, value, cb) {
    return this.context.set(this.prefixPath(path), value, cb)
  }

  insert(path, value, cb) {
    return this.context.insert(this.prefixPath(path), value, cb)
  }

  remove(path, len, cb) {
    return this.context.remove(this.prefixPath(path), len, cb)
  }

  push(path, value, cb) {
    path = this.prefixPath(path)

    const _ref = traverse(this.context.getSnapshot(), path)
    path.push(_ref.elem[_ref.key].length)

    return this.context.insert(path, value, cb)
  }

  move(path, from, to, cb) {
    return this.context.move(this.prefixPath(path), from, to, cb)
  }

  add(path, amount, cb) {
    return this.context.add(this.prefixPath(path), amount, cb)
  }

  on(event, cb) {
    return this.context.addListener(this.path, event, cb)
  }

  removeListener(l) {
    return this.context.removeListener(l)
  }

  getLength(path) {
    return this.context.getLength(this.prefixPath(path))
  }

  destroy() {
    this.context._removeSubDoc(this)
  }
}

// JSON API methods
// these methods are mixed in to the context return from doc.createContext()

class Json extends Context {
  static uri = uri

  static provides = {json: true}

  _subdocs = []
  _listeners = []

  _fixComponentPaths(c) {
    if (c.na !== undefined || c.si !== undefined || c.sd !== undefined) {
      return
    }

    const to_remove = []

    this._listeners.forEach((l, i) => {
      const dummy = {
        p: l.path,
        na: 0
      }
      const xformed = type.transformComponent([], dummy, c, 'left')

      if (xformed.length === 0) {
        to_remove.push(i)
      } else if (xformed.length === 1) {
        l.path = xformed[0].p
      } else {
        throw new Error(
          `Bad assumption in json-api: xforming an 'na' op
           will always result in 0 or 1 components.`
        )
      }
    })

    to_remove.sort((a, b) => b - a)

    return to_remove.map(i => this._listeners.splice(i, 1))
  }

  _fixPaths(op) {
    return op.map(c => this._fixComponentPaths(c))
  }

  _submit(op, callback) {
    this._fixPaths(op)
    return this.submitOp(op, callback)
  }

  _addSubDoc(subdoc) {
    this._subdocs.push(subdoc)
  }

  _removeSubDoc(subdoc) {
    this._subdocs.forEach((doc, i) => {
      if (doc === subdoc) this._subdocs.splice(i, 1)
    })
  }

  _updateSubdocPaths(op) {
    this._subdocs.forEach(doc => doc._updatePath(op))
  }

  createContextAt(...path) {
    const subdoc = new SubDoc(this, depath(path))
    this._addSubDoc(subdoc)

    return subdoc
  }

  get(path) {
    if (!path) return this.getSnapshot()

    const _ref = traverse(this.getSnapshot(), normalizePath(path))
    return _ref.elem[_ref.key]
  }

  set(path, value, cb) {
    path = normalizePath(path)

    const {elem, key} = traverse(this.getSnapshot(), path)
    const op = {
        p: path
    }

    if (elem.constructor === Array) {
      op.li = value
      if (typeof elem[key] !== 'undefined') {
        op.ld = elem[key]
      }
    } else if (typeof elem === 'object') {
      op.oi = value
      if (typeof elem[key] !== 'undefined') {
        op.od = elem[key]
      }
    } else {
      throw new Error('bad path')
    }

    return this._submit([op], cb)
  }

  remove(path, len, cb = () => {}) {
    if (typeof len === 'function') cb = len

    // if there is no len argument, then we are removing a single
    // item from either a list or a hash
    if (len !== void 0) {
      const {elem, key} = traverse(this.getSnapshot(), path)
      const op = {
        p: path
      }

      if (elem[key] === void 0) {
        throw new Error('No element at path')
      }

      if (Array.isArray(elem)) {
        op.ld = elem[key]
      } else if (typeof elem === 'object') {
        op.od = elem[key]
      } else {
        throw new Error('Bad path')
      }

      return this._submit([op], cb)
    } else {
      const pos = path.pop()
      const {elem, key} = traverse(this.getSnapshot(), path)

      if (typeof elem[key] === 'string') {
        return this._submit([{
          p: path.concat(pos),
          sd: elem[key].slice(pos, pos + len)
        }], cb)

      } else if (Array.isArray(elem[key])) {
        return this._submit(Array(pos + len).map((v, i) => {
          return {
            p: path.concat(pos),
            ld: elem[key][i]
          }
        }), cb)

      } else {
        throw new Error('Element at path does not support range.')
      }
    }
  }

  insert(path, value, cb) {
    const pos = path.pop()
    const {elem, key} = traverse(this.getSnapshot(), path)

    const op = {
      p: path.concat(pos)
    }

    if (Array.isArray(elem[key])) {
      op.li = value
    } else if (typeof elem[key] === 'string') {
      op.si = value
    }

    return this._submit([op], cb)
  }

  move(path, from, to, cb = () => {}) {
    const op = [{
      p: path.concat(from),
      lm: to
    }]

    return this._submit(op, () => {
      this._updateSubdocPaths(op)
      cb(arguments)
    })
  }

  push(path, value, cb) {
    const {elem, key} = traverse(this.getSnapshot(), path)
    path.push(elem[key].length)
    return this.insert(path, value, cb)
  }

  add(path, amount, cb) {
    return this._submit([{
      p: path,
      na: amount
    }], cb)
  }

  getLength(path) {
    return this.get(path).length
  }

  addListener(path, event, cb) {
    const listener = {
      path: path,
      event: event,
      cb: cb
    }

    this._listeners.push(listener)
    return listener
  }

  removeListener(listener) {
    const i = this._listeners.indexOf(listener)
    if (i < 0) return false

    this._listeners.splice(i, 1)
    return true
  }

  _onOp(op) {
    op.forEach(c => {
      this._fixComponentPaths(c)

      if (c.lm !== void 0) {
        this._updateSubdocPaths([c])
      }

      const match_path = c.na === void 0 ? c.p.slice(0, c.p.length - 1) : c.p

      this._listeners.forEach(listener => {
        const {cb} = listener

        if (pathEquals(listener.path, match_path)) {
          switch (listener.event) {
          case 'insert':
            if (c.li !== void 0 && c.ld === void 0) {
              cb(c.p[c.p.length - 1], c.li)
            } else if (c.oi !== void 0 && c.od === void 0) {
              cb(c.p[c.p.length - 1], c.oi)
            } else if (c.si !== void 0) {
              cb(c.p[c.p.length - 1], c.si)
            }
            break
          case 'delete':
            if (c.li === void 0 && c.ld !== void 0) {
              cb(c.p[c.p.length - 1], c.ld)
            } else if (c.oi === void 0 && c.od !== void 0) {
              cb(c.p[c.p.length - 1], c.od)
            } else if (c.sd !== void 0) {
              cb(c.p[c.p.length - 1], c.sd)
            }
            break
          case 'replace':
            if (c.li !== void 0 && c.ld !== void 0) {
              cb(c.p[c.p.length - 1], c.ld, c.li)
            } else if (c.oi !== void 0 && c.od !== void 0) {
              cb(c.p[c.p.length - 1], c.od, c.oi)
            }
            break
          case 'move':
            if (c.lm !== void 0) {
              cb(c.p[c.p.length - 1], c.lm)
            }
            break
          case 'add':
            if (c.na !== void 0) {
              cb(c.na)
            }
          }
        }

        if (type.canOpAffectPath(c, listener.path) &&
            listener.event === 'child op') {
          cb(c.p.slice(listener.path.length), c)
        }
      })
    })
  }
}

export default Json
