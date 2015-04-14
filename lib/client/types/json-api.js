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
  var key = 'data'
  var elem = { data: snapshot }

  for (var i = 0; i < path.length; i++) {
    elem = elem[key]
    key = path[i]
    if (typeof elem === 'undefined') {
      throw new Error('bad path')
    }
  }

  return {
    elem: elem,
    key: key
  }
}

function pathEquals(p1, p2) {
  if (p1.length !== p2.length) {
    return false
  }
  for (var i = 0; i < p1.length; ++i) {
    if (p1[i] !== p2[i]) {
      return false
    }
  }
  return true
}

function containsPath(p1, p2) {
  if (p1.length < p2.length) return false
  return pathEquals( p1.slice(0,p2.length), p2)
}

// does nothing, used as a default callback
function nullFunction() {}

// given a path represented as an array or a number, normalize to an array
// whole numbers are converted to integers.
function normalizePath(path) {
  if (path instanceof Array) {
    return path
  }
  if (typeof(path) == "number") {
    return [path]
  }
  // if (typeof(path) == "string") {
  //   path = path.split(".")
  //   var out = []
  //   for (var i=0; i<path.length; i++) {
  //     var part = path[i]
  //     if (String(parseInt(part, 10)) == part) {
  //       out.push(parseInt(part, 10))
  //     } else {
  //       out.push(part)
  //     }
  //   }
  //   return out
  // }
}

// helper for creating functions with the method signature func([path],arg1,arg2,...,[cb])
// populates an array of arguments with a default path and callback
function normalizeArgs(obj, args, func, requiredArgsCount){
  args = Array.prototype.slice.call(args)
  var path_prefix = obj.path || []

  if (func.length > 1 && typeof args[args.length-1] !== 'function') {
    args.push(nullFunction)
  }

  if (args.length < (requiredArgsCount || func.length)) {
    args.unshift(path_prefix)
  } else {
    args[0] = path_prefix.concat(normalizePath(args[0]))
  }

  return func.apply(obj,args)
}


// SubDoc
// this object is returned from context.createContextAt()

class SubDoc {
  constructor (context, path = []) {
    this.context = context
    this.path = path
  }

  _updatePath(op){
    op.forEach(({lm, p}) => {
      if (lm !== undefined && containsPath(this.path, p)) {
        const prefix = p.slice(0, c.p.length-1)

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

  _fixComponentPaths(c) {
    if (!this._listeners) {
      return
    }

    if (c.na !== undefined || c.si !== undefined || c.sd !== undefined) {
      return
    }

    const to_remove = []
    const _ref = this._listeners

    _ref.forEach(l => {
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
    const subdoc =  new SubDoc(this, depath(path))
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

  remove(path, len, cb) {
    return normalizeArgs(this, arguments, function(path, len, cb) {
      if (!cb && len instanceof Function) {
        cb = len
        len = null
      }
      // if there is no len argument, then we are removing a single item from either a list or a hash
      var _ref, elem, op, key
      if (len === null || len === undefined) {
        _ref = traverse(this.getSnapshot(), path)
        elem = _ref.elem
        key = _ref.key
        op = {
          p: path
        }

        if (typeof elem[key] === 'undefined') {
          throw new Error('no element at that path')
        }

        if (elem.constructor === Array) {
          op.ld = elem[key]
        } else if (typeof elem === 'object') {
          op.od = elem[key]
        } else {
          throw new Error('bad path')
        }
        return this._submit([op], cb)
      } else {
        var pos
        pos = path.pop()
        _ref = traverse(this.getSnapshot(), path)
        elem = _ref.elem
        key = _ref.key
        if (typeof elem[key] === 'string') {
          op = {
            p: path.concat(pos),
            sd: _ref.elem[_ref.key].slice(pos, pos + len)
          }
          return this._submit([op], cb)
        } else if (elem[key].constructor === Array) {
          var ops = []
          for (var i=pos; i<pos+len; i++) {
            ops.push({
              p: path.concat(pos),
              ld: elem[key][i]
            })
          }
          return this._submit(ops, cb)
        } else {
          throw new Error('element at path does not support range')
        }
      }
    }, 2)
  }

  insert(path, value, cb) {
    return normalizeArgs(this, arguments, function(path, value, cb) {
      var pos = path.pop()
      var _ref = traverse(this.getSnapshot(), path)
      var elem = _ref.elem
      var key = _ref.key
      var op = {
        p: path.concat(pos)
      }

      if (elem[key].constructor === Array) {
        op.li = value
      } else if (typeof elem[key] === 'string') {
        op.si = value
      }
      return this._submit([op], cb)
    })
  }

  move(path, from, to, cb) {
    return normalizeArgs(this, arguments, function(path, from, to, cb) {
      var self = this
      var op = [
        {
          p: path.concat(from),
          lm: to
        }
      ]

      return this._submit(op, function(){
        self._updateSubdocPaths(op)
        if(cb) cb.apply(cb, arguments)
      })
    })
  }

  push(path, value, cb) {
    return normalizeArgs(this, arguments, function(path, value, cb) {
      var _ref = traverse(this.getSnapshot(), path)
      var len = _ref.elem[_ref.key].length
      path.push(len)
      return this.insert(path, value, cb)
    })
  }

  add(path, amount, cb) {
    return normalizeArgs(this, arguments, function(path, value, cb) {
      var op = [
        {
          p: path,
          na: amount
        }
      ]
      return this._submit(op, cb)
    })
  }

  getLength(path) {
    return normalizeArgs(this, arguments, function(path) {
      return this.get(path).length
    })
  }

  getText(path) {
    return normalizeArgs(this, arguments, function(path) {
      console.warn("Deprecated. Use `get()` instead")
      return this.get(path)
    })
  }

  deleteText(path, length, pos, cb) {
    return normalizeArgs(this, arguments, function(path, length, pos, cb) {
      console.warn("Deprecated. Use `remove(path, length, cb)` instead")
      var _ref = traverse(this.getSnapshot(), path)
      var op = [
        {
          p: path.concat(pos),
          sd: _ref.elem[_ref.key].slice(pos, pos + length)
        }
      ]

      return this._submit(op, cb)
    })
  }

  addListener(path, event, cb) {
    return normalizeArgs(this, arguments, function(path, value, cb) {
      var listener = {
        path: path,
        event: event,
        cb: cb
      }
      this._listeners || (this._listeners = [])
      this._listeners.push(listener)
      return listener
    })
  }

  removeListener(listener) {
    if (!this._listeners) {
      return
    }
    var i = this._listeners.indexOf(listener)
    if (i < 0) {
      return false
    }
    this._listeners.splice(i, 1)
    return true
  }

  _onOp(op) {
    for (var i = 0; i < op.length; i++) {
      var c = op[i]
      this._fixComponentPaths(c)

      if(c.lm !== undefined) {
        this._updateSubdocPaths([c])
      }

      var match_path = c.na === undefined ? c.p.slice(0, c.p.length - 1) : c.p

      for (var l = 0; l < this._listeners.length; l++) {
        var listener = this._listeners[l]
        var cb = listener.cb

        if (pathEquals(listener.path, match_path)) {
          switch (listener.event) {
          case 'insert':
            if (c.li !== undefined && c.ld === undefined) {
              cb(c.p[c.p.length - 1], c.li)
            } else if (c.oi !== undefined && c.od === undefined) {
              cb(c.p[c.p.length - 1], c.oi)
            } else if (c.si !== undefined) {
              cb(c.p[c.p.length - 1], c.si)
            }
            break
          case 'delete':
            if (c.li === undefined && c.ld !== undefined) {
              cb(c.p[c.p.length - 1], c.ld)
            } else if (c.oi === undefined && c.od !== undefined) {
              cb(c.p[c.p.length - 1], c.od)
            } else if (c.sd !== undefined) {
              cb(c.p[c.p.length - 1], c.sd)
            }
            break
          case 'replace':
            if (c.li !== undefined && c.ld !== undefined) {
              cb(c.p[c.p.length - 1], c.ld, c.li)
            } else if (c.oi !== undefined && c.od !== undefined) {
              cb(c.p[c.p.length - 1], c.od, c.oi)
            }
            break
          case 'move':
            if (c.lm !== undefined) {
              cb(c.p[c.p.length - 1], c.lm)
            }
            break
          case 'add':
            if (c.na !== undefined) {
              cb(c.na)
            }
          }
        }

        if (type.canOpAffectPath(c, listener.path) && listener.event === 'child op') {
          var child_path = c.p.slice(listener.path.length)
          cb(child_path, c)
        }
      }
    }
  }
}
