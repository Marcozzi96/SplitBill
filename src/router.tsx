import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'

// Le route protette e le route dei link email (/auth/confirmEmail, /resetPassword)
// vengono aggiunte negli sprint successivi (vedi piano_di_sviluppo.md).
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
])
