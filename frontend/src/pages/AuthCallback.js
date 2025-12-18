import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { processGoogleSession, setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      // Extract session_id from URL fragment
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        toast.error('Authentication failed: No session ID');
        navigate('/login');
        return;
      }

      try {
        const userData = await processGoogleSession(sessionId);
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        
        toast.success(`Welcome, ${userData.name}!`);
        
        // Navigate to dashboard with user data to skip auth check
        navigate('/dashboard', { state: { user: userData }, replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error(error.message || 'Authentication failed');
        navigate('/login');
      }
    };

    processSession();
  }, []);

  // Show nothing during processing - happens fast enough
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
