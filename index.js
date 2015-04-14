// ShareJS
// =======
//
// Main entry point

import db from 'livedb'

import client from './lib/client'
import server from './lib/server'
import details from './package.json'

export default {
    client,
    server,
    db,
    version: details.version
}
