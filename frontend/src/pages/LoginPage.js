import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, KeyRound } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // First, check if password change is required by calling login API directly
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.detail || 'Login failed');
      }
      
      // Check if user must change password BEFORE setting user in context
      if (data?.must_change_password) {
        // Store token temporarily for password change
        if (data?.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }
        setShowChangePassword(true);
        toast.info('Please change your password to continue');
        return; // Don't proceed to dashboard
      }
      
      // No password change needed - proceed with normal login
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        credentials: 'include',
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (response.ok) {
        toast.success('Password changed successfully!');
        setShowChangePassword(false);
        // Now complete the login process with the new password
        await login(email, newPassword);
        navigate('/dashboard');
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'hsl(222.2 84% 4.9%)' }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(243 75% 49% / 0.12) 0%, transparent 70%)', top: '-10%', left: '-10%' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(243 75% 49% / 0.08) 0%, transparent 70%)', bottom: '-15%', right: '-10%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        {/* Glowing arc */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[500px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.3 }}>
          <svg viewBox="0 0 500 120" fill="none">
            <defs>
              <linearGradient id="loginArc" x1="0" y1="60" x2="500" y2="60">
                <stop offset="0%" stopColor="hsl(243 75% 49%)" stopOpacity="0" />
                <stop offset="30%" stopColor="hsl(243 75% 49%)" stopOpacity="0.3" />
                <stop offset="50%" stopColor="hsl(243 75% 49%)" stopOpacity="0.5" />
                <stop offset="70%" stopColor="hsl(243 75% 49%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(243 75% 49%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path d="M0 110 Q125 10, 250 10 Q375 10, 500 110" stroke="url(#loginArc)" strokeWidth="1.5" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.5 }} />
          </svg>
        </motion.div>
        {/* Noise overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundRepeat: 'repeat', backgroundSize: '256px' }} />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-md z-10"
      >
        <Card className="shadow-2xl border-white/[0.08] bg-white/[0.04] backdrop-blur-xl" style={{ background: 'hsl(222.2 60% 8% / 0.8)', borderColor: 'hsl(0 0% 100% / 0.08)' }}>
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="relative h-16 w-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-white/10">
                  <img src="/logo.png" alt="Sharda HR" className="h-10 w-10 object-contain" />
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <CardTitle className="text-2xl font-bold text-white">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Sign in to your Sharda HR account
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Sign In */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Button 
                variant="outline" 
                className="w-full h-11 gap-3 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
                onClick={handleGoogleLogin}
                data-testid="google-login-btn"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </motion.div>

            <div className="relative">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs text-slate-500" style={{ background: 'hsl(222.2 60% 8%)' }}>
                or continue with email
              </span>
            </div>

            {/* Email/Password Form */}
            <motion.form 
              onSubmit={handleSubmit} 
              className="space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/[0.08] h-11"
                    data-testid="email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/[0.08] h-11"
                    data-testid="password-input"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 font-semibold rounded-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300" 
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </motion.form>

            <p className="text-center text-sm text-slate-500">
              Contact HR administrator if you need access
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Change Your Password
            </DialogTitle>
            <DialogDescription>
              For security reasons, you must change your password before continuing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  data-testid="new-password-input"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  data-testid="confirm-password-input"
                />
              </div>
            </div>
            
            <p className="text-xs text-slate-500">
              Password must be at least 6 characters long.
            </p>
          </div>

          <DialogFooter>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword}
              className="w-full"
              data-testid="change-password-btn"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing Password...
                </>
              ) : (
                'Change Password & Continue'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
