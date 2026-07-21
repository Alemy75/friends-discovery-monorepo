import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';

export const router = createBrowserRouter([
  { path: '/', element: <AppShell />, children: [{ index: true, element: <HomeRoute /> }] },
]);
