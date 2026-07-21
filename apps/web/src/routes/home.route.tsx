import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { authErrorMessage } from '../auth/auth-error';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function HomeRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (logoutError) errorRef.current?.focus();
  }, [logoutError]);

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setLogoutError(authErrorMessage(err, {}, 'Не удалось выйти. Попробуйте ещё раз.'));
      setIsLoggingOut(false);
    }
  };

  return (
    <Card>
      <h1 className="text-xl font-geist font-medium text-ink">friends.ai</h1>
      <p className="mt-2 font-geist text-mid-gray">Вы вошли как {user?.email}</p>
      {logoutError ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className="mt-2 text-sm text-ember outline-none">
          {logoutError}
        </p>
      ) : null}
      <Button type="button" className="mt-4" onClick={handleLogout} disabled={isLoggingOut}>
        Выйти
      </Button>
    </Card>
  );
}
