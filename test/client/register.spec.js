import types from 'ottypes'

import {registerType} from '../../lib/client'

describe('registerType', () => {
  afterEach(() => {
    delete types.cool
    delete types['cool.mytypes']
  })

  it('registers a new type by name', () => {
    const type = {
      name: 'cool'
    }

    registerType(type)

    expect(types).to.have.a.property('cool', type)
  })

  it('registers a new type by uri', () => {
    const type = {
      uri: 'cool.mytypes'
    }

    registerType(type)

    expect(types).to.have.a.property('cool.mytypes', type)
  })

  it('registers a new type by name and uri', () => {
    const type = {
      name: 'cool',
      uri: 'cool.mytypes'
    }

    registerType(type)

    expect(types).to.have.a.property('cool', type)
    expect(types).to.have.a.property('cool.mytypes', type)
  })
})
