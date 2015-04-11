import types from 'ottypes'

// Register a new type on ottypes
const registerType = type => {
  if (type.name) {
    types[type.name] = type
  }

  if (type.uri) {
    types[type.uri] = type
  }
}

export default registerType
