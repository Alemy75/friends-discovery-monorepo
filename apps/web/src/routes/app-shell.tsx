import { Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Outlet />
    </div>
  );
}
