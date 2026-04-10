import { RouterProvider } from 'react-router';
import { router } from './routes';
import { JobProvider } from './lib/JobContext';

export default function App() {
  return (
    <JobProvider>
      <RouterProvider router={router} />
    </JobProvider>
  );
}
