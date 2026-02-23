import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthScreen } from './components/AuthScreen';
import { StudentDashboard } from './components/StudentDashboard';
import { ManagementDashboard } from './components/ManagementDashboard';
import { supabase } from './lib/supabase';

const ADMIN_EMAIL = 'vrishketuray@gmail.com';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load profile from cache first
    const cachedProfile = localStorage.getItem('sangam_profile_cache');
    if (cachedProfile) {
      try {
        setProfile(JSON.parse(cachedProfile));
      } catch (e) {
        console.error('Failed to parse cached profile');
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('Profile not found for user:', userId);
      } else {
        setProfile(data);
        localStorage.setItem('sangam_profile_cache', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem('sangam_profile_cache');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Check if user is admin by email or by profile role
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Toaster position="top-right" />
      
      {!user ? (
        <AuthScreen onAuthSuccess={(u) => {
          setUser(u);
          fetchProfile(u.id);
        }} />
      ) : (
        isAdmin ? (
          <ManagementDashboard user={user} profile={profile} onLogout={handleLogout} />
        ) : (
          <StudentDashboard user={user} profile={profile} onLogout={handleLogout} />
        )
      )}
    </div>
  );
}
