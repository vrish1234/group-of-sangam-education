import React, { useState, useEffect } from 'react';
import { GlassCard, GlassInput, GlassButton } from './ui/GlassComponents';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShieldCheck, GraduationCap, Building2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';

export const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    studentId: '',
  });

  // Enforce login mode when switching to admin
  useEffect(() => {
    if (role === 'admin') {
      setIsLogin(true);
    }
  }, [role]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // STRICT Admin Credentials Check
    if (role === 'admin') {
      const isAdminEmail = formData.email.toLowerCase() === 'vrishketuray@gmail.com';
      
      if (!isAdminEmail || formData.password !== 'Sangam@1234') {
        toast.error('Access Denied: Invalid Admin Credentials');
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          console.error('Supabase Login Error:', error.message);
          if (error.message.includes('Email not confirmed')) {
            toast.error('Email not confirmed. Please check your inbox for the verification link.');
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
          throw error;
        }

        onAuthSuccess(data.user);
        toast.success('Welcome back!');
      } else {
        // Registration is only for students
        if (role === 'admin' && formData.email.toLowerCase() !== 'vrishketuray@gmail.com') {
          throw new Error('Admin registration is disabled.');
        }

        const isSuperAdmin = formData.email.toLowerCase() === 'vrishketuray@gmail.com';

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: isSuperAdmin ? 'admin' : role,
              student_id: role === 'student' ? formData.studentId : null,
            }
          }
        });

        if (error) {
          console.error('Supabase Signup Error:', error.message);
          if (error.message.includes('Database error saving new user')) {
            toast.error('Database Sync Error: Please run the SQL script in SUPABASE_SETUP.sql in your Supabase Dashboard.');
          } else {
            toast.error(error.message);
          }
          throw error;
        }
        
        if (data.user && data.session) {
          onAuthSuccess(data.user);
          toast.success('Registration successful! Welcome to Sangam.');
        } else {
          toast.success('Registration successful! Please check your email to verify your account.');
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-white"
          >
            Group of Sangam
          </motion.h1>
          <p className="text-slate-400">Management System</p>
        </div>

        <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
          <button
            onClick={() => setRole('student')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              role === 'student' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap size={18} />
            Student
          </button>
          <button
            onClick={() => setRole('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              role === 'admin' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 size={18} />
            Admin
          </button>
        </div>

        <GlassCard className="space-y-6">
          <div className="flex justify-center gap-8 border-b border-white/10 pb-4">
            <button 
              onClick={() => setIsLogin(true)}
              className={`text-lg font-medium transition-all ${isLogin ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400'}`}
            >
              Login
            </button>
            {role === 'student' && (
              <button 
                onClick={() => setIsLogin(false)}
                className={`text-lg font-medium transition-all ${!isLogin ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400'}`}
              >
                Register
              </button>
            )}
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && role === 'student' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <GlassInput
                    label="Full Name"
                    placeholder="John Doe"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                  {role === 'student' && (
                    <GlassInput
                      label="Student ID"
                      placeholder="SANGAM-2024-001"
                      required
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <GlassInput
              label="Email Address"
              type="email"
              placeholder={role === 'admin' ? 'admin@sangam.com' : 'john@example.com'}
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <GlassInput
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <GlassButton 
              type="submit" 
              className="w-full mt-4"
              isLoading={isLoading}
              variant={role === 'student' ? 'primary' : 'secondary'}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </GlassButton>
          </form>

          {!isLogin && (
            <div className="pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-slate-500 mb-2">Getting "Database error"?</p>
              <button 
                onClick={() => toast('Please run the SQL script in SUPABASE_SETUP.sql in your Supabase SQL Editor to fix database sync issues.', { duration: 6000, icon: 'ℹ️' })}
                className="text-xs text-teal-400 hover:underline"
              >
                View Setup Guide
              </button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
