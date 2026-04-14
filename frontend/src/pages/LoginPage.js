import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
import { Mail, Lock, Loader2, KeyRound, Check, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { API_URL, BACKEND_BASE } from '../config';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Password strength validation
  const passwordChecks = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{}|;:',.<>?/`~]/.test(newPassword),
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const data = await login(email, password);

      if (data?.must_change_password) {
        setShowChangePassword(true);
        toast.info('Please change your password to continue');
        return;
      }

      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('[LoginPage] Login error:', error);
      // Show the actual error from the server
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
    if (!allChecksPassed) {
      toast.error('Password does not meet all requirements');
      return;
    }

    setChangingPassword(true);
    try {
      const { ok, data } = await apiRequest(`${API_URL}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (ok) {
        localStorage.removeItem('access_token');
        setShowChangePassword(false);
        setNewPassword('');
        setConfirmPassword('');
        setPassword('');
        toast.success('Password changed! Please sign in with your new password.');
      } else {
        toast.error(data?.detail || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
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
            <motion.div initial={{ scale: 0.5, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}>
              <div className="relative h-16 w-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-white/10">
                  <img src="/logo.png" alt="Sharda HR" className="h-10 w-10 object-contain" />
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
              <CardDescription className="text-slate-400 mt-1">Sign in to your Sharda HR account</CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.form onSubmit={handleSubmit} className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/[0.08] h-11" data-testid="email-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/[0.08] h-11" data-testid="password-input" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-semibold rounded-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300" disabled={loading} data-testid="login-submit-btn">
                {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>) : 'Sign In'}
              </Button>
            </motion.form>
            <p className="text-center text-sm text-slate-500">Contact HR administrator if you need access</p>
            <p className="text-center text-[10px] text-slate-600/40 mt-2 font-mono select-all" data-testid="api-url-debug">{BACKEND_BASE || 'NOT SET'}</p>
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
            <DialogDescription>For security reasons, you must change your password before continuing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="new-password" type={showNewPassword ? "text" : "password"} placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 pr-10" data-testid="new-password-input" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" data-testid="toggle-password-visibility">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="confirm-password" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" data-testid="confirm-password-input" />
              </div>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 space-y-1.5" data-testid="password-requirements">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Password Requirements
              </p>
              {[
                { key: 'minLength', label: 'At least 8 characters' },
                { key: 'hasUpper', label: 'One uppercase letter (A-Z)' },
                { key: 'hasLower', label: 'One lowercase letter (a-z)' },
                { key: 'hasNumber', label: 'One number (0-9)' },
                { key: 'hasSpecial', label: 'One special character (!@#$%...)' },
                { key: 'matches', label: 'Passwords match' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-xs" data-testid={`pw-check-${key}`}>
                  {passwordChecks[key] ? <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                  <span className={passwordChecks[key] ? 'text-green-700' : 'text-slate-500'}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={changingPassword || !allChecksPassed} className="w-full" data-testid="change-password-btn">
              {changingPassword ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing Password...</>) : 'Change Password & Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
