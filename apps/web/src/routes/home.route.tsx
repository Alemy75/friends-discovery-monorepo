import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function HomeRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Card>
      <h1 className="text-xl font-geist font-medium text-ink">friends.ai</h1>
      <p className="mt-2 font-geist text-mid-gray">Вы вошли как {user?.email}</p>
      <Button
        type="button"
        className="mt-4"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
      >
        Выйти
      </Button>
    </Card>
  );
}
