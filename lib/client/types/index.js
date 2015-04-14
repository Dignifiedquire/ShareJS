// Previously this file tried to require all the OT types that were listed in
// the ottypes library. I think its easier to just do this.

// The types register themselves on their respective types.
import Text from './text-api'
import Text2 from './text-tp2-api'

// The JSON API is buggy!!
import Json from './json-api'

export default {
  [Text.uri]: Text,
  [Text2.uri]: Text2,
  [Json.uri]: Json
}
