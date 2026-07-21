import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';
import { RegisterScreen } from './register.route';

export const router = createBrowserRouter([
  { path: '/register', element: <RegisterScreen /> },
  { path: '/', element: <AppShell />, children: [{ index: true, element: <HomeRoute /> }] },
]);
