import React, { useMemo, useState, useEffect } from 'react';
import { Bell, Send, Users } from 'lucide-react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { PortalNavbar } from './PortalNavbar';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';

export const ManagementDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'scholarships' | 'about'>('home');
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messageTitle, setMessageTitle] = useState('Admin Notice');
  const [messageBody, setMessageBody] = useState('');
  const [notificationTarget, setNotificationTarget] = useState('all');

  const fetchData = async () => {
    const [studentsRes, scholarshipRes, notificationsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('scholarship_forms').select('student_id,status'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5)
    ]);

    const statusMap = new Map((scholarshipRes.data || []).map((s: any) => [s.student_id, s.status || 'pending']));
    const merged = (studentsRes.data || []).map((student: any) => ({
      ...student,
      scholarship_status: statusMap.get(student.id) || 'pending'
    }));
    setStudents(merged);
    if (notificationsRes.data) setNotifications(notificationsRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = (student.full_name || '').toLowerCase().includes(studentSearch.toLowerCase());
      const matchesStatus = studentFilter === 'all' || student.scholarship_status === studentFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, studentSearch, studentFilter]);

  const handleSendNotification = async () => {
    if (!messageBody.trim()) return;

    let targets = students;
    if (notificationTarget !== 'all') {
      targets = students.filter((student) => student.id === notificationTarget);
    }

    const payload = targets.map((student) => ({
      user_id: student.id,
      title: messageTitle,
      message: messageBody,
      is_read: false
    }));

    const { error } = await supabase.from('notifications').insert(payload);
    if (error) {
      toast.error('Failed to send notification');
      return;
    }

    toast.success(`Message sent to ${notificationTarget === 'all' ? 'all students' : 'selected student'}`);
    setMessageBody('');
    fetchData();
  };

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
        onLogout={onLogout}
        userName={profile?.full_name || user?.email}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {activeTab === 'home' && (
          <>
            <GlassCard className="rounded-xl shadow-md">
              <h2 className="text-2xl font-bold text-cyan-200">Admin Dashboard</h2>
              <p className="text-slate-300">Manage students and instant notifications.</p>
            </GlassCard>

            <GlassCard className="space-y-4 rounded-xl shadow-md">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-200"><Users size={18} /> Student List</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <GlassInput placeholder="Search student name" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-slate-100">
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 p-3 shadow-md">
                    <div>
                      <p className="font-semibold">{student.full_name}</p>
                      <p className="text-sm text-slate-400">{student.email}</p>
                    </div>
                    <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${student.scholarship_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {student.scholarship_status}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="space-y-4 rounded-xl shadow-md">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-200"><Bell size={18} /> Send Admin Message</h3>
              <GlassInput placeholder="Title" value={messageTitle} onChange={(e) => setMessageTitle(e.target.value)} />
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type message for students"
                className="min-h-24 w-full rounded-xl border border-white/10 bg-white/10 p-3"
              />
              <select value={notificationTarget} onChange={(e) => setNotificationTarget(e.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-slate-100">
                <option value="all">All Students</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}
              </select>
              <GlassButton onClick={handleSendNotification} className="w-fit"><Send size={16} /> Send Message</GlassButton>
            </GlassCard>
          </>
        )}

        {activeTab === 'scholarships' && (
          <GlassCard className="rounded-xl shadow-md">
            <h3 className="text-xl font-semibold text-cyan-200">Scholarship Overview</h3>
            <p className="text-slate-200">Use Home tab filters to quickly sort approved and pending students.</p>
          </GlassCard>
        )}

        {activeTab === 'about' && (
          <GlassCard className="rounded-xl shadow-md">
            <h3 className="text-xl font-semibold text-cyan-200">About Admin Panel</h3>
            <p className="text-slate-200">This panel is optimized for communication and scholarship monitoring.</p>
          </GlassCard>
        )}
      </main>
    </div>
  );
};
