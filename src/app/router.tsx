import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { EditorPage } from '@/pages/EditorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <EditorPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  {
    // Support subpath deployments (e.g. GitHub Pages at /<repo>/).
    basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
  },
);
