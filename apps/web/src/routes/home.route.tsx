import { useAuth } from '../auth/use-auth';
import { Card } from '../ui/card';

export function HomeRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return (
    <Card>
      <h1 className="text-xl font-medium">friends.ai</h1>
      {isLoading ? (
        <p>Загрузка…</p>
      ) : isAuthenticated ? (
        <p>Вы вошли как {user?.email}</p>
      ) : (
        <p>Вы не вошли в систему.</p>
      )}
    </Card>
  );
}
