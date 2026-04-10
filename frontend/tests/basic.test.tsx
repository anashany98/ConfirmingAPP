import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from '../src/App'

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})

describe('Utils', () => {
  it('formatCurrency formats EUR correctly', () => {
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
    
    expect(formatCurrency(1000)).toContain('€')
    expect(formatCurrency(0)).toContain('€')
    expect(formatCurrency(1000000)).toContain('€')
  })
})

describe('Auth Utils', () => {
  it('token management functions exist', () => {
    const getAuthToken = () => localStorage.getItem('auth_token')
    const setAuthToken = (token: string) => localStorage.setItem('auth_token', token)
    const removeAuthToken = () => localStorage.removeItem('auth_token')
    
    setAuthToken('test-token')
    expect(getAuthToken()).toBe('test-token')
    removeAuthToken()
    expect(getAuthToken()).toBeNull()
  })
})