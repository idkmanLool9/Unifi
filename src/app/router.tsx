import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AuthoringPage } from '@/features/authoring/AuthoringPage';
import { LibraryPage } from '@/features/library/workspace/LibraryPage';
import { EditorPage } from '@/pages/EditorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    // Device Authoring Mode and the Library own their full chrome.
    { path: 'author', element: <AuthoringPage /> },
    { path: 'library', element: <LibraryPage /> },
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
