import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';
import { RegisterScreen } from './register.route';
import { VerifyScreen } from './verify.route';
import { LoginScreen } from './login.route';

export const router = createBrowserRouter([
  { path: '/register', element: <RegisterScreen /> },
  { path: '/verify', element: <VerifyScreen /> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/', element: <AppShell />, children: [{ index: true, element: <HomeRoute /> }] },
]);
