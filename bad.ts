// @ts-nocheck

type ID = string | number

interface ApiResponse<T> {
  data: T
  error?: string
}

interface User {
  id: ID
  name: string
  age?: number
}

let user: User = {
  id: true, // ❌ boolean not assignable to ID
  name: 123, // ❌ number not assignable to string
}


