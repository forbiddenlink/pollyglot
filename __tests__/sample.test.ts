import { describe, it, expect } from 'vitest'

describe('Sample Tests', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    const greeting = 'Hello, Pollyglot!'
    expect(greeting).toContain('Pollyglot')
  })
})
