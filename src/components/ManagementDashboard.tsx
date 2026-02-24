import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, Bell, Calendar, CheckCircle2, DollarSign, FileSpreadsheet, Send, Video } from 'lucide-react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { PortalNavbar } from './PortalNavbar';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

type TabKey = 'home' | 'scholarships' | 'live' | 'tests' | 'revenue' | 'about';

export const ManagementDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const fetchData = async () => {
    const [studentsRes, formsRes, notificationsRes, testPayRes, msgRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('scholarship_forms').select('*'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('test_payments').select('*').eq('status', 'paid'),
      supabase.from('class_messages').select('*').order('created_at', { ascending: false }).limit(20)
    ]);
    setStudents(studentsRes.data || []);
    setForms(formsRes.data || []);
    setNotifications(notificationsRes.data || []);
    setTestPayments(testPayRes.data || []);
    setClassMessages(msgRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const formsByStudent = useMemo(() => new Map(forms.map((f) => [f.student_id, f])), [forms]);

  const filteredStudents = useMemo(() => students.filter((s) => {
    const form = formsByStudent.get(s.id);
    const status = form?.status || 'pending';
    return (s.full_name || '').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || status === statusFilter);
  }), [students, search, statusFilter, formsByStudent]);

  const sendNotification = async (userIds: string[], title: string, message: string) => {
    if (!userIds.length) return;
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
    if (!liveLink.trim()) return;
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

  const revenue = useMemo(() => {
    const scholarshipPaid = forms.filter((f) => f.payment_status === 'paid').reduce((s, f) => s + Number(f.fee_paid || 0), 0);
    const testPaid = testPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = scholarshipPaid + testPaid;

    const now = new Date();
    const day = testPayments.filter((p) => new Date(p.created_at).toDateString() === now.toDateString()).length;
    const week = testPayments.filter((p) => (now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 7).length;
    const month = testPayments.filter((p) => new Date(p.created_at).getMonth() === now.getMonth()).length;

    const defaulters = forms.filter((f) => f.payment_status !== 'paid');
    return { scholarshipPaid, testPaid, total, day, week, month, defaulters };
  }, [forms, testPayments]);

  return (
    <div className="min-h-screen page-fade text-slate-100">
      <PortalNavbar
        links={[{ key: 'home', label: 'Home' }, { key: 'scholarships', label: 'Scholarships' }, { key: 'live', label: 'Live Class' }, { key: 'tests', label: 'Weekly Test' }, { key: 'revenue', label: 'Revenue' }, { key: 'about', label: 'About' }]}
        activeKey={activeTab}
        onNavigate={(key) => setActiveTab(key as TabKey)}
        notifications={notifications}
        onLogout={onLogout}
        userName={profile?.full_name || user?.email}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {activeTab === 'home' && <>
          <GlassCard><h2 className="text-2xl font-bold text-cyan-200">Management Dashboard</h2><p className="text-slate-300">Control scholarship flow, live classes, tests and revenue.</p></GlassCard>
          <GlassCard className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-200"><Calendar size={18} /> Batch Admit Card Publisher</h3>
            <div className="grid gap-3 md:grid-cols-3"><input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-2xl border border-white/10 bg-white/10 p-2" /><GlassInput placeholder="Exam Centre" value={examCentre} onChange={(e) => setExamCentre(e.target.value)} /><GlassButton onClick={publishAdmitCards}>Publish Admit Cards</GlassButton></div>
          </GlassCard>
          <GlassCard className="space-y-3">
            <h3 className="text-lg font-semibold text-cyan-200">Student List (Search + Filter)</h3>
            <div className="grid gap-3 md:grid-cols-3"><GlassInput placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-2xl border border-white/10 bg-white/10 p-2"><option value="all">All</option><option value="approved">Approved</option><option value="pending">Pending</option></select></div>
            {filteredStudents.map((s) => <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/10 p-3"><div><p>{s.full_name}</p><p className="text-xs text-slate-300">{formsByStudent.get(s.id)?.registration_id || 'No Reg ID'}</p></div><div className="flex gap-2">{formsByStudent.get(s.id)?.status !== 'approved' && <GlassButton size="sm" onClick={() => approveScholarship(s.id)}><CheckCircle2 size={14} />Approve</GlassButton>}</div></div>)}
          </GlassCard>
          <GlassCard><h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-cyan-200"><FileSpreadsheet size={18} /> Excel Result Upload</h3><input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && uploadResultsExcel(e.target.files[0])} /></GlassCard>
        </>}

        {activeTab === 'scholarships' && <GlassCard><h3 className="text-xl font-semibold text-cyan-200">Scholarship Operations</h3><p>₹300 payment + registration ID + approval workflow are active system-wide.</p></GlassCard>}

        {activeTab === 'live' && <>
          <GlassCard className="space-y-3"><h3 className="flex items-center gap-2 text-xl font-semibold text-cyan-200"><Video size={18} /> Publish Live Class</h3><GlassInput placeholder="Class Title" value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} /><GlassInput placeholder="YouTube Live URL or Jitsi URL" value={liveLink} onChange={(e) => setLiveLink(e.target.value)} /><GlassButton onClick={publishLiveClass}><Send size={16} /> Publish & Notify</GlassButton></GlassCard>
          <GlassCard><h4 className="mb-2 text-lg font-semibold text-cyan-200">Student Questions</h4>{classMessages.map((m) => <div key={m.id} className="mb-2 rounded-xl bg-white/10 p-2"><p className="text-sm"><strong>{m.student_name || 'Student'}:</strong> {m.message}</p></div>)}</GlassCard>
        </>}

        {activeTab === 'tests' && <GlassCard className="space-y-3"><h3 className="text-xl font-semibold text-cyan-200">Weekly MCQ Test Creator</h3><GlassInput placeholder="Test title" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} /><GlassInput type="number" placeholder="Duration minutes" value={testDuration} onChange={(e) => setTestDuration(Number(e.target.value))} /><textarea value={questionsText} onChange={(e) => setQuestionsText(e.target.value)} className="min-h-44 w-full rounded-2xl border border-white/10 bg-white/10 p-3" placeholder="One question per line: Question|A|B|C|D|correctIndex" /><GlassButton onClick={createWeeklyTest}>Create Test & Notify</GlassButton></GlassCard>}

        {activeTab === 'revenue' && <>
          <GlassCard><h3 className="flex items-center gap-2 text-xl font-semibold text-cyan-200"><DollarSign size={18} /> Revenue Dashboard</h3><p className="mt-2">Total Revenue: <strong>₹{revenue.total}</strong> (Scholarship ₹{revenue.scholarshipPaid} + Tests ₹{revenue.testPaid})</p><p>Paid: Today {revenue.day} • Week {revenue.week} • Month {revenue.month}</p></GlassCard>
          <GlassCard><h4 className="mb-3 flex items-center gap-2 text-lg font-semibold text-cyan-200"><BarChart3 size={18} /> Analytics</h4><div className="space-y-2">{[{ label: 'Scholarship', value: revenue.scholarshipPaid }, { label: 'Weekly Tests', value: revenue.testPaid }].map((b) => <div key={b.label}><div className="mb-1 flex justify-between text-sm"><span>{b.label}</span><span>₹{b.value}</span></div><div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${Math.min(100, (b.value / Math.max(1, revenue.total)) * 100)}%` }} /></div></div>)}</div></GlassCard>
          <GlassCard><h4 className="mb-2 text-lg font-semibold text-cyan-200">Defaulter List</h4>{revenue.defaulters.map((d: any) => <p key={d.id} className="text-sm">{students.find((s) => s.id === d.student_id)?.full_name || d.student_id}</p>)}</GlassCard>
        </>}

        {activeTab === 'about' && <GlassCard><h3 className="text-xl font-semibold text-cyan-200">About Management Suite</h3><p>Private workflow for scholarship lifecycle, live classes, tests and finance.</p></GlassCard>}
      </main>
    </div>
  );
};
