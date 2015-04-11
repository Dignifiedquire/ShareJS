// ShareJS
// =======
//
// Main entry point

import db from 'livedb'

import client from './lib/client'
import server from './lib/server'
import types from './lib/types'
import details from './package.json'

export default {
    client,
    server,
    types,
    db,
    version: details.version
}
