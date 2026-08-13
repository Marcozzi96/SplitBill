import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import FriendsPage from './pages/FriendsPage'
import GroupsPage from './pages/GroupsPage'
import BalancesPage from './pages/BalancesPage'
import ProfilePage from './pages/ProfilePage'

// Le route protette (route guard) e le route dei link email
// (/auth/confirmEmail, /resetPassword) vengono aggiunte dallo Sprint 2.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/friends', element: <FriendsPage /> },
      { path: '/groups', element: <GroupsPage /> },
      { path: '/balances', element: <BalancesPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
])
