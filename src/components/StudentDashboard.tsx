import React, { useMemo, useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, CreditCard, User } from 'lucide-react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { PortalNavbar } from './PortalNavbar';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';

type TabKey = 'home' | 'scholarships' | 'live' | 'tests' | 'payments' | 'about';

const makeRegistrationId = () => `SNG-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;

type TabKey = 'home' | 'scholarships' | 'live' | 'tests' | 'payments' | 'about';

const makeRegistrationId = () => `SNG-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;

export const StudentDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'scholarships' | 'about'>('home');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [scholarshipStatus, setScholarshipStatus] = useState<any[]>([]);
  const [scholarshipSearch, setScholarshipSearch] = useState('');
  const [scholarshipFilter, setScholarshipFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [hasUnread, setHasUnread] = useState(false);

  const fetchData = async () => {
    const [notifyRes, scholarshipRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('scholarship_forms').select('*').eq('student_id', user.id).order('created_at', { ascending: false })
    ]);

    if (notifyRes.data) {
      setNotifications(notifyRes.data);
      setHasUnread(notifyRes.data.some((n: any) => !n.is_read));
    }
    if (scholarshipRes.data) setScholarshipStatus(scholarshipRes.data);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`student-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          const notification = payload.new;
          if (!notification || (notification.user_id && notification.user_id !== user.id)) return;
          setNotifications((prev) => [notification, ...prev].slice(0, 5));
          setHasUnread(true);
          toast(notification.message || 'New admin message');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const filteredScholarships = useMemo(() => {
    return scholarshipStatus.filter((s: any) => {
      const matchesSearch = (s.data?.student_name || profile?.full_name || '').toLowerCase().includes(scholarshipSearch.toLowerCase());
      const matchesFilter = scholarshipFilter === 'all' || s.status === scholarshipFilter;
      return matchesSearch && matchesFilter;
    });
  }, [scholarshipStatus, scholarshipSearch, scholarshipFilter, profile?.full_name]);

  return (
    <div className="min-h-screen page-fade text-slate-100">
      <PortalNavbar
        links={[
          { key: 'home', label: 'Home' },
          { key: 'scholarships', label: 'Scholarships' },
          { key: 'about', label: 'About' }
        ]}
        activeKey={activeTab}
        onNavigate={(key) => setActiveTab(key as any)}
        notifications={notifications}
        hasUnread={hasUnread}
        onLogout={onLogout}
        userName={profile?.full_name}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {activeTab === 'home' && (
          <>
            <GlassCard className="rounded-xl shadow-md">
              <h2 className="text-2xl font-bold text-cyan-200">Welcome, {profile?.full_name}</h2>
              <p className="text-slate-300">Student dashboard overview.</p>
            </GlassCard>

            <div className="grid gap-6 md:grid-cols-2">
              <GlassCard className="rounded-xl shadow-md">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-cyan-200"><User size={18} /> Profile</h3>
                <p><strong>Email:</strong> {profile?.email}</p>
                <p><strong>Student ID:</strong> {profile?.student_id || 'N/A'}</p>
              </GlassCard>

              <GlassCard className="rounded-xl shadow-md">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-cyan-200"><Bell size={18} /> Latest Notices</h3>
                <div className="space-y-2">
                  {notifications.length ? notifications.map((n) => (
                    <div key={n.id} className="rounded-xl bg-white/10 p-3">
                      <p className="font-medium text-cyan-200">{n.title || 'Admin Update'}</p>
                      <p className="text-sm text-slate-200">{n.message}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No updates yet.</p>}
                </div>
              </GlassCard>
            </div>

            <GlassCard className="rounded-xl shadow-md">
              <h3 className="mb-4 text-lg font-semibold text-cyan-200">Notice Board</h3>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={`board-${n.id}`} className="rounded-xl border border-white/10 bg-white/10 p-3">
                    <p className="font-semibold text-cyan-200">{n.title || 'Notice'}</p>
                    <p>{n.message}</p>
                    <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}

        {activeTab === 'scholarships' && (
          <GlassCard className="space-y-4 rounded-xl shadow-md">
            <h3 className="text-xl font-semibold text-cyan-200">Scholarship Applications</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <GlassInput value={scholarshipSearch} onChange={(e) => setScholarshipSearch(e.target.value)} placeholder="Search by name" />
              <select
                value={scholarshipFilter}
                onChange={(e) => setScholarshipFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-slate-100"
              >
                <option value="all">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredScholarships.length ? filteredScholarships.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 p-4 shadow-md shadow-black/20">
                  <div>
                    <p className="font-semibold">{item.data?.student_name || profile?.full_name}</p>
                    <p className="text-sm text-slate-400">Payment: {item.payment_status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'approved' ? <CheckCircle2 className="text-green-500" size={18} /> : <Clock className="text-amber-500" size={18} />}
                    <span className="capitalize text-cyan-200">{item.status}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">No scholarship records found.</p>}
            </div>
            <GlassButton>Apply for New Scholarship</GlassButton>
          </GlassCard>
        )}

        {activeTab === 'about' && (
          <GlassCard className="rounded-xl shadow-md">
            <h3 className="text-xl font-semibold text-cyan-200">About Sangam Education Portal</h3>
            <p className="mt-2 text-slate-200">Sangam helps students manage scholarships, notices, and academic communication in one place.</p>
          </GlassCard>
        )}
      </main>
    </div>
  );
};
