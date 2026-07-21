import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer } from './lib/di/container';
import { ContainerProvider } from './lib/di/react';
import { createQueryClient } from './lib/query';
import { router } from './routes/router';

const container = createAppContainer({ apiBaseUrl: '/api/v1' });
const queryClient = createQueryClient();

export function App() {
  return (
    <ContainerProvider container={container}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ContainerProvider>
  );
}
