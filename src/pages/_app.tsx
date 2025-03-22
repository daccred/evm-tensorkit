import type { AppProps } from 'next/app'
import { AuthProvider } from '@/contexts/AuthContext'
import '../styles/globals.css';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from "@/components/ui/toaster"
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const colorScheme = computedStyle.getPropertyValue('--mode').trim().replace(/"/g, '');
    if (colorScheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
    setMounted(true);
  }, []);

  // Prevent flash while theme loads
  if (!mounted) {
    return null;
  }

  // Check if the current page is the preview page
  const isPreviewPage = router.pathname.startsWith('/preview/');

  return (
    <div className="min-h-screen">
      <AuthProvider>
        {isPreviewPage ? (
          // Don't wrap preview pages with ProtectedRoute
          <Component {...pageProps} />
        ) : (
          // Wrap all other pages with ProtectedRoute
          <ProtectedRoute>
            <Component {...pageProps} />
          </ProtectedRoute>
        )}
        <Toaster />
      </AuthProvider>
    </div>
  )
}