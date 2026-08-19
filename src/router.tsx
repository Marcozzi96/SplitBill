import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RequireAuth from './auth/RequireAuth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConfirmEmailPage from './pages/ConfirmEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import FriendsPage from './pages/FriendsPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import FriendDetailPage from './pages/FriendDetailPage'
import BalancesPage from './pages/BalancesPage'
import PaymentsPage from './pages/PaymentsPage'
import ProfilePage from './pages/ProfilePage'

export const router = createBrowserRouter([
  // Route pubbliche di autenticazione.
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  // Route dei link inviati via email (il path deve coincidere con OPEN_LINK del backend).
  { path: '/auth/confirmEmail', element: <ConfirmEmailPage /> },
  { path: '/resetPassword', element: <ResetPasswordPage /> },
  // Route protette.
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/friends', element: <FriendsPage /> },
          { path: '/friends/:userId', element: <FriendDetailPage /> },
          { path: '/groups', element: <GroupsPage /> },
          { path: '/groups/:groupId', element: <GroupDetailPage /> },
          { path: '/balances', element: <BalancesPage /> },
          { path: '/payments', element: <PaymentsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
])
