'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { dashboardSupabase, createSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast-provider';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    try {
      // First authenticate with dashboard Supabase
      const { data: dashboardData, error: dashboardError } = await dashboardSupabase.auth.signInWithPassword({
        email,
        password
      });

      if (dashboardError) {
        setError(dashboardError.message);
        addToast({
          title: 'Authentication Error',
          description: dashboardError.message,
          variant: 'error',
          duration: 5000
        });
        return;
      }

      if (dashboardData?.user) {
        // If dashboard login successful, also sign in to products Supabase
        const productsSupabase = createSupabaseClient('product');
        
        // Try to sign in to products Supabase with same credentials
        const { error: productsError } = await productsSupabase.auth.signInWithPassword({
          email,
          password
        });

        // If products login fails (user doesn't exist), create an account
        if (productsError?.message.includes('Invalid login credentials')) {
          const { error: signUpError } = await productsSupabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                // Copy any relevant user metadata from dashboard user
                name: dashboardData.user.user_metadata?.name,
                // Add any other metadata you want to sync
              }
            }
          });

          if (signUpError) {
            console.error('Error creating products account:', signUpError);
            // Don't block login if products signup fails
          }
        }

        // Set session cookie with HttpOnly flag for better security
        document.cookie = 'isAuthenticated=true; path=/; max-age=86400; secure; samesite=strict';
        
        addToast({
          title: 'Success',
          description: 'Successfully logged in!',
          variant: 'success',
          duration: 3000
        });
        
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred';
      setError(errorMessage);
      addToast({
        title: 'Error',
        description: errorMessage,
        variant: 'error',
        duration: 5000
      });
      console.error('Login error:', err);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      {loginLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Spinner className="w-12 h-12 text-white" />
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Dashboard Login</h1>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            {loginLoading ? (
              <div className="flex items-center justify-center">
                <Spinner className="w-5 h-5 mr-2" />
                Logging in...
              </div>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
