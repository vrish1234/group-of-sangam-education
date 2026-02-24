import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  LogOut,
  MessageSquare,
  Send,
  Upload,
  Users,
  Video
} from 'lucide-react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

type TabKey = 'students' | 'scholarships' | 'notifications' | 'admit_cards' | 'results' | 'classes' | 'payments' | 'feedback';

export const ManagementDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [examDate, setExamDate] = useState('');
  const [examCentre, setExamCentre] = useState('');
  const [liveTitle, setLiveTitle] = useState('Live Class');
  const [liveLink, setLiveLink] = useState('');
  const [questionsText, setQuestionsText] = useState('');
  const [testTitle, setTestTitle] = useState('Weekly Test');
  const [testDuration, setTestDuration] = useState(10);
  const [testPayments, setTestPayments] = useState<any[]>([]);
  const [classMessages, setClassMessages] = useState<any[]>([]);
  const [admitCards, setAdmitCards] = useState<any[]>([]);
  const [revenueStats, setRevenueStats] = useState({ scholarship: 0, tests: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('Admin Notice');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const fetchData = async () => {
    const [studentsRes, formsRes, notificationsRes, testPayRes, msgRes, admitRes, scholarshipPayRes, weeklyPayRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('scholarship_forms').select('*'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('test_payments').select('*').eq('status', 'paid'),
      supabase.from('class_messages').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('admit_cards').select('student_id,registration_id,exam_date,exam_centre'),
      supabase.from('scholarship_forms').select('fee_paid').eq('payment_status', 'paid'),
      supabase.from('test_payments').select('amount').eq('status', 'paid')
    ]);

    setStudents(studentsRes.data || []);
    setForms(formsRes.data || []);
    setNotifications(notificationsRes.data || []);
    setTestPayments(testPayRes.data || []);
    setClassMessages(msgRes.data || []);
    setAdmitCards(admitRes.data || []);
    const scholarship = (scholarshipPayRes.data || []).reduce((sum: number, r: any) => sum + Number(r.fee_paid || 0), 0);
    const tests = (weeklyPayRes.data || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    setRevenueStats({ scholarship, tests });
  };

  useEffect(() => { fetchData(); }, []);

  const formsByStudent = useMemo(() => new Map(forms.map((f) => [f.student_id, f])), [forms]);

  const filteredStudents = useMemo(() => students.filter((s) => {
    const form = formsByStudent.get(s.id);
    const status = form?.status || 'pending';
    return (s.full_name || '').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || status === statusFilter);
  }), [students, search, statusFilter, formsByStudent]);

  const sendNotification = async (userIds: string[], title: string, message: string) => {
    if (!userIds.length || !message.trim()) return;
    await supabase.from('notifications').insert(userIds.map((id) => ({ user_id: id, title, message, is_read: false })));
  };

  const approveScholarship = async (studentId: string) => {
    const { data } = await supabase.from('scholarship_forms').select('*').eq('student_id', studentId).maybeSingle();
    if (!data) return toast.error('No scholarship record');
    await supabase.from('scholarship_forms').update({ status: 'approved' }).eq('student_id', studentId);
    await sendNotification([studentId], 'Scholarship Approved', 'Your scholarship application has been approved.');
    toast.success('Student approved');
    fetchData();
  };

  const publishAdmitCards = async () => {
    if (!examDate || !examCentre) return toast.error('Set exam date and centre first');
    const approved = forms.filter((f) => f.status === 'approved' && f.registration_id);
    const payload = approved.map((f) => ({ student_id: f.student_id, registration_id: f.registration_id, exam_date: examDate, exam_centre: examCentre }));
    const { error } = await supabase.from('admit_cards').upsert(payload, { onConflict: 'student_id' });
    if (error) return toast.error('Failed to publish admit cards');
    await sendNotification(approved.map((f) => f.student_id), 'Admit Card Ready', `Exam Date ${examDate}, Centre ${examCentre}`);
    toast.success(`Published admit cards for ${approved.length} students`);
    fetchData();
  };

  const uploadResultsExcel = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    for (const row of rows) {
      const regId = row['Registration ID'];
      if (!regId) continue;
      const { data: form } = await supabase.from('scholarship_forms').select('student_id').eq('registration_id', String(regId)).maybeSingle();
      if (!form?.student_id) continue;
      await supabase.from('results').upsert({ student_id: form.student_id, subject: row['Subject'] || 'Weekly', marks: Number(row['Marks'] || 0), total_marks: Number(row['Total'] || 100), rank: Number(row['Rank'] || 0), semester: row['Semester'] || '2025' });
      await sendNotification([form.student_id], 'Result Published', 'Your latest result has been published.');
    }
    toast.success('Excel results synced');
  };

  const publishLiveClass = async () => {
    if (!liveLink.trim()) return toast.error('Enter live link');
    await supabase.from('online_classes').upsert({ id: 1, title: liveTitle, link: liveLink, youtube_id: liveLink.includes('youtu') ? (liveLink.split('v=')[1]?.split('&')[0] || liveLink.split('/').pop()) : null, date: new Date().toISOString() });
    await sendNotification(students.map((s) => s.id), 'New Live Class', `${liveTitle} is now scheduled.`);
    toast.success('Live class published');
  };

  const createWeeklyTest = async () => {
    const questions = questionsText.split('\n').filter(Boolean).map((line) => {
      const [question, a, b, c, d, idx] = line.split('|');
      return { question, options: [a, b, c, d], correctIndex: Number(idx || 0) };
    });
    const { error } = await supabase.from('tests').insert({ title: testTitle, fee: 10, duration_minutes: testDuration, questions });
    if (error) return toast.error('Failed to create test');
    await sendNotification(students.map((s) => s.id), 'New Weekly Test', `${testTitle} is now available.`);
    toast.success('Weekly test scheduled');
  };

  const sendBroadcast = async () => {
    await sendNotification(students.map((s) => s.id), broadcastTitle, broadcastMessage);
    toast.success('Notification sent');
    setBroadcastMessage('');
    fetchData();
  };

  const revenue = useMemo(() => {
    const scholarshipPaid = revenueStats.scholarship;
    const testPaid = revenueStats.tests;
    const total = scholarshipPaid + testPaid;
    const now = new Date();
    const day = testPayments.filter((p) => new Date(p.created_at).toDateString() === now.toDateString()).length;
    const week = testPayments.filter((p) => (now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 7).length;
    const month = testPayments.filter((p) => new Date(p.created_at).getMonth() === now.getMonth()).length;
    const defaulters = forms.filter((f) => f.payment_status !== 'paid');
    return { scholarshipPaid, testPaid, total, day, week, month, defaulters };
  }, [forms, testPayments, revenueStats]);

  const navItems = [
    { id: 'students', label: 'Students', icon: Users },
    { id: 'scholarships', label: 'Scholarships', icon: Upload },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'admit_cards', label: 'Admit Cards', icon: Calendar },
    { id: 'results', label: 'Results', icon: FileSpreadsheet },
    { id: 'classes', label: 'Classes', icon: Video },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ] as const;

  return (
    <div className="min-h-screen page-fade text-slate-100 md:flex">
      <aside className="glass w-full p-6 md:w-72 md:min-h-screen md:rounded-none">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/80"><Building2 /></div>
          <div>
            <p className="text-3xl font-bold">Sangam Admin</p>
            <p className="text-xs text-slate-300">Welcome back, {profile?.full_name || 'Admin'}</p>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as TabKey)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${activeTab === item.id ? 'bg-blue-500/80 shadow-lg shadow-blue-500/30' : 'hover:bg-white/10'}`}>
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="mt-8 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-red-200 hover:bg-red-500/10"><LogOut size={20} /> Logout</button>
      </aside>

      <main className="flex-1 space-y-6 p-4 md:p-8">
        {activeTab === 'students' && (
          <>
            <GlassCard><h2 className="text-4xl font-bold">Admin Dashboard</h2></GlassCard>
            <GlassCard className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <GlassInput placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-2xl border border-white/10 bg-white/10 p-2"><option value="all">All</option><option value="approved">Approved</option><option value="pending">Pending</option></select>
              </div>
              {filteredStudents.map((s) => { const admit = admitCards.find((a) => a.student_id === s.id); return <div key={s.id} className="rounded-2xl bg-white/10 p-3"><p className="font-semibold">{s.full_name}</p><p className="text-sm text-slate-300">Reg: {formsByStudent.get(s.id)?.registration_id || 'No Reg ID'}</p><p className="text-xs text-slate-400">Exam: {admit?.exam_date || 'N/A'} • {admit?.exam_centre || 'N/A'}</p>{formsByStudent.get(s.id)?.status !== 'approved' && <GlassButton size="sm" className="mt-2" onClick={() => approveScholarship(s.id)}><CheckCircle2 size={14}/> Approve</GlassButton>}</div>; })}
            </GlassCard>
          </>
        )}

        {activeTab === 'scholarships' && <GlassCard><h3 className="text-2xl font-bold">Scholarship Operations</h3><p>Manage approvals, payments and registration IDs.</p></GlassCard>}

        {activeTab === 'notifications' && (
          <GlassCard className="space-y-3">
            <h3 className="text-2xl font-bold">Notifications</h3>
            <GlassInput placeholder="Title" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
            <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-white/10 p-3" placeholder="Broadcast message" />
            <GlassButton onClick={sendBroadcast}><Send size={16}/> Send to All Students</GlassButton>
            <div className="space-y-2">{notifications.map((n) => <div key={n.id} className="rounded-xl bg-white/10 p-3"><p className="font-semibold">{n.title}</p><p>{n.message}</p></div>)}</div>
          </GlassCard>
        )}

        {activeTab === 'admit_cards' && <GlassCard className="space-y-3"><h3 className="text-2xl font-bold">Admit Card Publisher</h3><div className="grid gap-3 md:grid-cols-3"><input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-2xl border border-white/10 bg-white/10 p-2" /><GlassInput placeholder="Exam Centre" value={examCentre} onChange={(e) => setExamCentre(e.target.value)} /><GlassButton onClick={publishAdmitCards}>Publish Admit Cards</GlassButton></div></GlassCard>}

        {activeTab === 'results' && <GlassCard><h3 className="mb-3 text-2xl font-bold">Excel Result Upload</h3><input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && uploadResultsExcel(e.target.files[0])} /></GlassCard>}

        {activeTab === 'classes' && <>
          <GlassCard className="space-y-3"><h3 className="text-2xl font-bold">Live Classes</h3><GlassInput placeholder="Class title" value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} /><GlassInput placeholder="YouTube/Jitsi link" value={liveLink} onChange={(e) => setLiveLink(e.target.value)} /><GlassButton onClick={publishLiveClass}>Publish Class</GlassButton></GlassCard>
          <GlassCard><h4 className="mb-2 text-lg font-semibold">Student Questions</h4>{classMessages.map((m) => <div key={m.id} className="mb-2 rounded-xl bg-white/10 p-2">{m.student_name}: {m.message}</div>)}</GlassCard>
          <GlassCard className="space-y-3"><h3 className="text-2xl font-bold">Weekly Test Creator</h3><GlassInput placeholder="Test title" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} /><GlassInput type="number" placeholder="Duration" value={testDuration} onChange={(e) => setTestDuration(Number(e.target.value))} /><textarea value={questionsText} onChange={(e) => setQuestionsText(e.target.value)} className="min-h-40 w-full rounded-2xl border border-white/10 bg-white/10 p-3" placeholder="Question|A|B|C|D|correctIndex" /><GlassButton onClick={createWeeklyTest}>Create Test</GlassButton></GlassCard>
        </>}

        {activeTab === 'payments' && <>
          <GlassCard><h3 className="text-2xl font-bold">Revenue Dashboard</h3><p>Total Revenue: ₹{revenue.total} (Scholarship ₹{revenue.scholarshipPaid} + Tests ₹{revenue.testPaid})</p><p>Paid Today {revenue.day} • Week {revenue.week} • Month {revenue.month}</p></GlassCard>
          <GlassCard><h4 className="mb-3 flex items-center gap-2 text-xl font-semibold"><BarChart3 size={18}/> Payment Analytics</h4><div className="space-y-2">{[{ label: 'Scholarship', value: revenue.scholarshipPaid }, { label: 'Weekly Tests', value: revenue.testPaid }].map((b) => <div key={b.label}><div className="mb-1 flex justify-between"><span>{b.label}</span><span>₹{b.value}</span></div><div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${Math.min(100, (b.value / Math.max(1, revenue.total)) * 100)}%` }} /></div></div>)}</div></GlassCard>
          <GlassCard><h4 className="text-lg font-semibold">Defaulter List</h4>{revenue.defaulters.map((d: any) => <p key={d.id}>{students.find((s) => s.id === d.student_id)?.full_name || d.student_id}</p>)}</GlassCard>
        </>}

        {activeTab === 'feedback' && <GlassCard><h3 className="text-2xl font-bold">Feedback</h3><p>This section is visible now as requested. You can wire table-based feedback replies here.</p></GlassCard>}
      </main>
    </div>
  );
};
