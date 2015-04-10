// Operations
// ==========
//
// Dealing with operations.

// Helper function to set opData to contain a no-op.
export const setNoOp = opData => {
  delete opData.op
  delete opData.create
  delete opData.del
}

export const isNoOp = opData => {
  return !opData.op && !opData.create && !opData.del
}

// Try to compose data2 into data1. Returns truthy if it succeeds, otherwise falsy.
export const tryCompose = (type, data1, data2) => {
  if (data1.create && data2.del) {
    setNoOp(data1)
  } else if (data1.create && data2.op) {
    // Compose the data into the create data.
    var data = (data1.create.data === undefined) ? type.create() : data1.create.data
    data1.create.data = type.apply(data, data2.op)
  } else if (isNoOp(data1)) {
    data1.create = data2.create
    data1.del = data2.del
    data1.op = data2.op
  } else if (data1.op && data2.op && type.compose) {
    data1.op = type.compose(data1.op, data2.op)
  } else {
    return false
  }
  return true
}

// Transform server op data by a client op, and vice versa. Ops are edited in place.
export const xf = (client, server) => {
  // In this case, we're in for some fun. There are some local operations
  // which are totally invalid - either the client continued editing a
  // document that someone else deleted or a document was created both on the
  // client and on the server. In either case, the local document is way
  // invalid and the client's ops are useless.
  //
  // The client becomes a no-op, and we keep the server op entirely.
  if (server.create || server.del) setNoOp(client)
    if (client.create) throw new Error('Invalid state. This is a bug. ' + this.collection + ' ' + this.name)

  // The client has deleted the document while the server edited it. Kill the
  // server's op.
  if (client.del) return setNoOp(server)

  // We only get here if either the server or client ops are no-op. Carry on,
  // nothing to see here.
  if (!server.op || !client.op) return

  // They both edited the document. This is the normal case for this function -
  // as in, most of the time we'll end up down here.
  //
  // You should be wondering why I'm using client.type instead of this.type.
  // The reason is, if we get ops at an old version of the document, this.type
  // might be undefined or a totally different type. By pinning the type to the
  // op data, we make sure the right type has its transform function called.
  if (client.type.transformX) {
    var result = client.type.transformX(client.op, server.op)
    client.op = result[0]
    server.op = result[1]
  } else {
    var _c = client.type.transform(client.op, server.op, 'left')
    var _s = client.type.transform(server.op, client.op, 'right')
    client.op = _c
    server.op = _s
  }
}