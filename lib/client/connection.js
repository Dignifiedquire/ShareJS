import {EventEmitter} from 'events'

import Doc from './doc'
import Query from './query'

const hasKeys = object => Object.keys(object).length > 0

/**
 * Handles communication with the sharejs server and provides queries and
 * documents.
 *
 * We create a connection with a socket object
 *   connection = new sharejs.Connection(sockset)
 * The socket may be any object handling the websocket protocol. See the
 * documentation of bindToSocket() for details. We then wait for the connection
 * to connect
 *   connection.on('connected', ...)
 * and are finally able to work with shared documents
 *   connection.get('food', 'steak') // Doc
 *
 * @param socket @see bindToSocket
 */
class Connection extends EventEmitter {
  constructor(socket) {
    super()

    // Map of collection -> docName -> doc object for created documents.
    // (created documents MUST BE UNIQUE)
    this.collections = {}

    // Each query is created with an id that the server uses when it sends us
    // info about the query (updates, etc).
    //this.nextQueryId = (Math.random() * 1000) |0
    this.nextQueryId = 1

    // Map from query ID -> query object.
    this.queries = {}

    // State of the connection. The correspoding events are emmited when this
    // changes. Available states are:
    // - 'connecting'   The connection has been established, but we don't have
    //                  our client ID yet
    // - 'connected'    We have connected and recieved our client ID.
    //                  Ready for data.
    // - 'disconnected' The connection is closed, but it will reconnect
    //                  automatically.
    // - 'stopped'      The connection is closed, and should not reconnect.
    this.state = 'disconnected'

    // This is a helper variable the document uses to see whether
    // we're currently in a 'live' state. It is true if we're connected,
    // or if you're using browserchannel and connecting.
    this.canSend = false

    // Private variable to support clearing of op retry interval
    this._retryInterval = null

    // Reset some more state variables.
    this.reset()

    this.debug = false

    // I'll store the most recent 100 messages so when errors occur we can see
    // what happened.
    this.messageBuffer = []

    this.bindToSocket(socket)
  }

  /**
   * Use socket to communicate with server
   *
   * Socket is an object that can handle the websocket protocol. This method
   * installs the onopen, onclose, onmessage and onerror handlers on the socket
   * to handle communication and sends messages by calling socket.send(msg). The
   * sockets `readyState` property is used to determine the initaial state.
   *
   * @param socket Handles the websocket protocol
   * @param socket.readyState
   * @param socket.close
   * @param socket.send
   * @param socket.onopen
   * @param socket.onclose
   * @param socket.onmessage
   * @param socket.onerror
   */
  bindToSocket(socket) {
    if (this.socket) {
      delete this.socket.onopen
      delete this.socket.onclose
      delete this.socket.onmessage
      delete this.socket.onerror
    }

    // TODO: Check that the socket is in the 'connecting' state.

    this.socket = socket
    // This logic is replicated in setState - consider calling setState here
    // instead.
    if (socket.readyState === 0 || socket.readyState === 1) {
      this.state = 'connecting'
    } else {
      this.state = 'disconnected'
    }

    this.canSend = this.state === 'connecting' && socket.canSendWhileConnecting
    this._setupRetry()

    socket.onmessage = ({data}) => {
      // Some transports don't need parsing.
      if (typeof data === 'string') data = JSON.parse(data)

      if (this.debug) console.log('RECV', JSON.stringify(data))

      this.messageBuffer.push({
        t: (new Date()).toTimeString(),
        recv: JSON.stringify(data)
      })

      while (this.messageBuffer.length > 100) {
        this.messageBuffer.shift()
      }

      try {
        this.handleMessage(data)
      } catch (e) {
        this.emit('error', e)
        // We could also restart the connection here, although that might result
        // in infinite reconnection bugs.
        throw e
      }
    }

    socket.onopen = () => {
      this._setState('connecting')
    }

    socket.onerror = err => {
      // This isn't the same as a regular error, because it will happen normally
      // from time to time. Your connection should probably automatically
      // reconnect anyway, but that should be triggered off onclose not onerror.
      // (onclose happens when onerror gets called anyway).
      this.emit('connection error', err)
    }

    socket.onclose = reason => {
      this._setState('disconnected', reason)
      if (reason === 'Closed' || reason === 'Stopped by server') {
        this._setState('stopped', reason)
      }
    }
  }

  /**
   * @param {object} msg
   * @param {String} msg.a action
   */
  handleMessage(msg) {
    const {
      // action
      a,
      // collection name
      c,
      // document name
      d,
      // bulk subscribe content
      s,
      // message id
      id,
      // protocol version
      protocol
    } = msg

    // Switch on the message action. Most messages are for documents and are
    // handled in the doc class.
    switch (a) {
    case 'init':
      // Client initialization packet. This bundle of joy contains our client
      // ID.
      if (protocol !== 0) throw new Error('Invalid protocol version')
      if (typeof id !== 'string') throw new Error('Invalid client id')

      this.id = id
      this._setState('connected')
      break

    case 'qfetch':
    case 'qsub':
    case 'q':
    case 'qunsub':
      // Query message. Pass this to the appropriate query object.
      const query = this.queries[id]
      if (query) query._onMessage(msg)
      break

    case 'bs':
      // Bulk subscribe response. The responses for each document are
      // contained within.
      let result = s
      for (let cName in result) {
        for (let docName in result[cName]) {
          const doc = this.get(cName, docName)
          if (!doc) {
            if (console) {
              console.error('Message for unknown doc. Ignoring.', msg)
            }
            break
          }

          const element = result[cName][docName]
          if (typeof element === 'object') {
            doc._handleSubscribe(element.error, element)
          } else {
            // The msg will be true if we simply resubscribed.
            doc._handleSubscribe(null, null)
          }
        }
      }
      break

    default:
      // Document message. Pull out the referenced document and forward the
      // message.
      if (d) {
        this._lastReceivedCollection = c
        this._lastReceivedDoc = d
      }

      const existing = this.getExisting(this._lastReceivedCollection,
                                        this._lastReceivedDoc)
      if (existing) existing._onMessage(msg)
    }
  }

  reset() {
    this.id = null
    this.lastError = null
    this._lastReceivedCollection = null
    this._lastReceivedDoc = null
    this._lastSentCollection = null
    this._lastSentDoc = null

    this.seq = 1
  }

  _setupRetry() {
    if (!this.canSend) {
      clearInterval(this._retryInterval)
      this._retryInterval = null
      return
    }

    if (this._retryInterval != null) return

    this._retryInterval = setInterval(() => {
      for (let collectionName in this.collections) {
        const collection = this.collections[collectionName]

        for (let docName in collection) {
          collection[docName].retry()
        }
      }
    }, 1000)
  }

  // Set the connection's state. The connection is basically a state machine.
  _setState(newState, data) {
    if (this.state === newState) return

    // I made a state diagram. The only invalid transitions are getting to
    // 'connecting' from anywhere other than 'disconnected' and getting to
    // 'connected' from anywhere other than 'connecting'.
    if ((newState === 'connecting' &&
         (this.state !== 'disconnected' && this.state !== 'stopped'))
        || (newState === 'connected' && this.state !== 'connecting')) {
      throw new Error(
        `Cannot transition directly from ${this.state} to ${newState}`)
    }

    this.state = newState

    if (newState === 'connecting' && this.socket.canSendWhileConnecting) {
      this.canSend = true
    }

    if (newState === 'connected') {
      this.canSend = true
    }

    this._setupRetry()

    if (newState === 'disconnected') this.reset()

    this.emit(newState, data)

    let ignoreSubs = {}
    // No bulk subscribe for queries yet.
    for (let id in this.queries) {
      const query = this.queries[id]
      query._onConnectionStateChanged(newState, data)
      if (
        query.docMode === 'sub' &&
          (newState === 'connecting' || newState === 'connected')
      ) {
        const ignoreSubsCollection = ignoreSubs[query.collection] ||
              (ignoreSubs[query.collection] = {})
        for (let i = 0; i < query.results.length; i++) {
          ignoreSubsCollection[query.results[i].name] = true
        }
      }
    }

    // & Emit the event to all documents & queries. It might make sense for
    // documents to just register for this stuff using events, but that couples
    // connections and documents a bit much. Its not a big deal either way.
    this.opQueue = []
    this.bsStart()
    for (let c in this.collections) {
      const collection = this.collections[c]
      for (let docName in collection) {
        if (ignoreSubs[c] && ignoreSubs[c][docName]) continue
        collection[docName]._onConnectionStateChanged(newState, data)
      }
    }

    // Its important that operations are resent in the same order that they were
    // originally sent. If we don't sort, an op with a high sequence number will
    // convince the server not to accept any ops with earlier sequence numbers.
    this.opQueue.sort((a, b) => a.seq - b.seq)

    for (let i = 0; i < this.opQueue.length; i++) {
      this.send(this.opQueue[i])
    }

    this.opQueue = null
    this.bsEnd()
  }

  // So, there's an awful error case where the client sends two requests (which
  // fail), then reconnects. The documents could have _onConnectionStateChanged
  // called in the wrong order and the operations then get sent with reversed
  // sequence numbers. This causes the server to incorrectly reject the second
  // sent op. So we need to queue the operations while we're reconnecting and
  // resend them in the correct order.
  sendOp(data) {
    if (this.opQueue) {
      this.opQueue.push(data)
    } else {
      this.send(data)
    }
  }

  bsStart() {
    this.subscribeData = {}
  }

  bsEnd() {
    // Only send bulk subscribe if not empty
    if (hasKeys(this.subscribeData)) {
      this.send({a: 'bs', s: this.subscribeData})
    }
    this.subscribeData = null
  }

  // This is called by the document class when the document wants to subscribe.
  // We could just send a subscribe message, but during reconnect that causes a
  // bajillion messages over browserchannel. During reconnect we'll aggregate,
  // similar to sendOp.
  sendSubscribe(collection, name, v) {
    if (this.subscribeData) {
      const data = this.subscribeData
      if (!data[collection]) data[collection] = {}

      data[collection][name] = v || null
    } else {
      const msg = {a: 'sub', c: collection, d: name}
      if (v != null) msg.v = v
      this.send(msg)
    }
  }

  /**
   * Sends a message down the socket
   */
  send(msg) {
    if (this.debug) console.log('SEND', JSON.stringify(msg))

    this.messageBuffer.push({t: Date.now(), send: JSON.stringify(msg)})

    while (this.messageBuffer.length > 100) {
      this.messageBuffer.shift()
    }

    const {
      // collection name
      c,
      // document name
      d
    } = msg

    if (d) { // The document the message refers to. Not set for queries.
      if (c === this._lastSentCollection && d === this._lastSentDoc) {
        delete msg.c
        delete msg.d
      } else {
        this._lastSentCollection = c
        this._lastSentDoc = d
      }
    }

    if (!this.socket.canSendJSON) {
      msg = JSON.stringify(msg)
    }

    this.socket.send(msg)
  }

  /**
   * Closes the socket and emits 'disconnected'
   */
  disconnect() {
    this.socket.close()
  }

  getExisting(collection, name) {
    if (this.collections[collection]) return this.collections[collection][name]
  }

  /**
   * Get or create a document.
   *
   * @param collection
   * @param name
   * @param [data] ingested into document if created
   * @return {Doc}
   */
  get(collection, name, data) {
    let collectionObject = this.collections[collection]

    if (!collectionObject) {
      collectionObject = this.collections[collection] = {}
    }

    let doc = collectionObject[name]

    if (!doc) {
      doc = collectionObject[name] = new Doc(this, collection, name)
    }

    // Even if the document isn't new, its possible the document was created
    // manually and then tried to be re-created with data (suppose a query
    // returns with data for the document). We should hydrate the document
    // immediately if we can because the query callback will expect the document
    // to have data.
    if (data && data.data !== undefined && !doc.state) {
      doc.ingestData(data)
    }

    return doc
  }

  /**
   * Remove document from this.collections
   *
   * @private
   */
  _destroyDoc(doc) {
    const collectionObject = this.collections[doc.collection]
    if (!collectionObject) return

    delete collectionObject[doc.name]

    // Delete the collection container if its empty. This could be a source of
    // memory leaks if you slowly make a billion collections, which you probably
    // won't do anyway, but whatever.
    if (!hasKeys(collectionObject)) {
      delete this.collections[doc.collection]
    }
  }

  // Helper for createFetchQuery and createSubscribeQuery, below.
  _createQuery(type, collection, q, options = {}, callback) {
    if (type !== 'fetch' && type !== 'sub') {
      throw new Error('Invalid query type: ' + type)
    }

    const id = this.nextQueryId++
    const query = new Query(type, this, id, collection, q, options, callback)
    this.queries[id] = query
    query._execute()
    return query
  }

  // Internal function. Use query.destroy() to remove queries.
  _destroyQuery(query) {
    delete this.queries[query.id]
  }

  // The query options object can contain the following fields:
  //
  // docMode: What to do with documents that are in the result set. Can be
  //   null/undefined (default), 'fetch' or 'subscribe'. Fetch mode indicates
  //   that the server should send document snapshots to the client for all
  //   query results. These will be hydrated into the document objects before
  //   the query result callbacks are returned. Subscribe mode gets document
  //   snapshots and automatically subscribes the client to all results. Note
  //   that the documents *WILL NOT* be automatically unsubscribed when the
  //   query is destroyed. (ShareJS doesn't have enough information to do
  //   that safely). Beware of memory leaks when using this option.
  //
  // poll: Forcably enable or disable polling mode. Polling mode will reissue
  //   the query every time anything in the collection changes (!!) so, its
  //   quite expensive. It is automatically enabled for paginated and sorted
  //   queries. By default queries run with polling mode disabled which will
  //   only check changed documents to test if they now match the specified
  //   query. Set to false to disable polling mode, or true to enable it. If
  //   you don't specify a poll option, polling mode is enabled or disabled
  //   automatically by the query's backend.
  //
  // backend: Set the backend source for the query. You can attach different
  //   query backends to livedb and pick which one the query should hit using
  //   this parameter.
  //
  // results: (experimental) Initial list of resultant documents. This is
  //   useful for rehydrating queries when you're using autoFetch/autoSubscribe
  //   so the server doesn't have to send over snapshots for documents the
  //   client already knows about. This is experimental - the API may change
  //   in upcoming versions.

  // Create a fetch query. Fetch queries are only issued once, returning the
  // results directly into the callback.
  //
  // The index is specific to the source, but if you're using mongodb it'll be
  // the collection to which the query is made.
  // The callback should have the signature function(error, results, extraData)
  // where results is a list of Doc objects.
  createFetchQuery(index, q, options, callback) {
    return this._createQuery('fetch', index, q, options, callback)
  }

  // Create a subscribe query. Subscribe queries return with the initial data
  // through the callback, then update themselves whenever the query result set
  // changes via their own event emitter.
  //
  // If present, the callback should have the signature
  // function(error, results, extraData) where results is a list of Doc objects.
  createSubscribeQuery(index, q, options, callback) {
    return this._createQuery('sub', index, q, options, callback)
  }
}
