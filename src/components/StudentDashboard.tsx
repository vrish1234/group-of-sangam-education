import React, { useMemo, useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock3, CreditCard, FileText, PlayCircle, ReceiptIndianRupee, User, XCircle } from 'lucide-react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { PortalNavbar } from './PortalNavbar';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';

type TabKey = 'home' | 'scholarships' | 'live' | 'tests' | 'payments' | 'about';

const makeRegistrationId = () => `SNG-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;

export const StudentDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [scholarshipRecord, setScholarshipRecord] = useState<any>(null);
  const [admitCard, setAdmitCard] = useState<any>(null);
  const [latestResult, setLatestResult] = useState<any>(null);
  const [liveClass, setLiveClass] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [tests, setTests] = useState<any[]>([]);
  const [testPayments, setTestPayments] = useState<Set<string>>(new Set());
  const [activeTest, setActiveTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [testSummary, setTestSummary] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const fetchData = async () => {
    const [notifyRes, scholarshipRes, admitRes, resultRes, classRes, testsRes, testPayRes, historyRes] = await Promise.all([
      supabase.from('notifications').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('created_at', { ascending: false }).limit(10),
      supabase.from('scholarship_forms').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('admit_cards').select('*').eq('student_id', user.id).maybeSingle(),
      supabase.from('results').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('online_classes').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('tests').select('*').order('created_at', { ascending: false }),
      supabase.from('test_payments').select('test_id,amount,status,created_at').eq('student_id', user.id),
      supabase.from('test_history').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(10)
    ]);

    if (notifyRes.data) {
      setNotifications(notifyRes.data);
      setHasUnread(notifyRes.data.some((n: any) => !n.is_read));
    }
    setScholarshipRecord(scholarshipRes.data || null);
    setAdmitCard(admitRes.data || null);
    setLatestResult(resultRes.data || null);
    setLiveClass(classRes.data || null);
    setTests(testsRes.data || []);
    setTestPayments(new Set((testPayRes.data || []).filter((p: any) => p.status === 'paid').map((p: any) => p.test_id)));
    setHistory(historyRes.data || []);

    const paymentRows = [
      ...(scholarshipRes.data ? [{ id: `sch-${scholarshipRes.data.id}`, type: 'Scholarship', amount: scholarshipRes.data.fee_paid || 0, status: scholarshipRes.data.payment_status, created_at: scholarshipRes.data.created_at }] : []),
      ...((testPayRes.data || []).map((p: any, i: number) => ({ id: `test-${i}`, type: 'Weekly Test', amount: p.amount, status: p.status, created_at: p.created_at })))
    ];
    setPaymentHistory(paymentRows);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel(`student-notifications-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
      const notification = payload.new;
      if (!notification || (notification.user_id && notification.user_id !== user.id)) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      setHasUnread(true);
      toast.success(notification.message || 'New update');
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  useEffect(() => {
    if (!activeTest || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [activeTest, secondsLeft]);

  useEffect(() => {
    if (activeTest && secondsLeft <= 0) submitTest();
  }, [secondsLeft]);

  const timeline = useMemo(() => {
    const applied = !!scholarshipRecord;
    const paid = scholarshipRecord?.payment_status === 'paid';
    const approved = scholarshipRecord?.status === 'approved';
    const admitReady = !!admitCard;
    const resultOut = !!latestResult;
    return [applied, paid, approved, admitReady, resultOut];
  }, [scholarshipRecord, admitCard, latestResult]);

  const applyAndPayScholarship = async () => {
    const registrationId = scholarshipRecord?.registration_id || makeRegistrationId();
    const { error } = await supabase.from('scholarship_forms').upsert({
      student_id: user.id,
      registration_id: registrationId,
      payment_status: 'paid',
      fee_paid: 300,
      status: scholarshipRecord?.status || 'pending',
      data: { student_name: profile?.full_name, student_email: profile?.email }
    }, { onConflict: 'student_id' });

    if (error) return toast.error('Payment failed');
    toast.success(`₹300 paid. Registration ID: ${registrationId}`);
    await supabase.from('notifications').insert({ user_id: user.id, title: 'Payment Successful', message: `Scholarship fee paid. Registration ID: ${registrationId}` });
    fetchData();
  };

  const generateAdmitPdf = () => {
    if (!admitCard || !scholarshipRecord?.registration_id) return toast.error('Admit card not available yet');
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Sangam Education Admit Card', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Name: ${profile?.full_name}`, 20, 45);
    doc.text(`Registration ID: ${scholarshipRecord.registration_id}`, 20, 55);
    doc.text(`Exam Date: ${admitCard.exam_date}`, 20, 65);
    doc.text(`Exam Centre: ${admitCard.exam_centre}`, 20, 75);
    doc.save(`Admit_${scholarshipRecord.registration_id}.pdf`);
  };

  const payForTest = async (test: any) => {
    const { error } = await supabase.from('test_payments').upsert({ student_id: user.id, test_id: test.id, amount: 10, status: 'paid' }, { onConflict: 'student_id,test_id' });
    if (error) return toast.error('₹10 payment failed');
    const doc = new jsPDF();
    doc.text('Sangam Weekly Test Receipt', 20, 20);
    doc.text(`Student: ${profile?.full_name}`, 20, 35);
    doc.text(`Test: ${test.title}`, 20, 45);
    doc.text('Amount: ₹10 (Paid)', 20, 55);
    doc.save(`Receipt_Test_${test.id}.pdf`);
    toast.success('Payment successful ✓');
    fetchData();
  };

  const startTest = (test: any) => {
    setTestSummary(null);
    setAnswers({});
    setActiveTest(test);
    setSecondsLeft((test.duration_minutes || 10) * 60);
  };

  const submitTest = async () => {
    if (!activeTest) return;
    const questions = activeTest.questions || [];
    const correct = questions.reduce((acc: number, q: any, i: number) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0);
    const total = questions.length || 1;
    const marks = Math.round((correct / total) * 100);

    await supabase.from('test_history').insert({ student_id: user.id, test_id: activeTest.id, score: marks, correct_count: correct, total_questions: total });
    await supabase.from('results').insert({ student_id: user.id, subject: activeTest.title, marks, total_marks: 100, semester: 'Weekly', rank: null });
    await supabase.from('notifications').insert({ user_id: user.id, title: 'Test Submitted', message: `${activeTest.title} submitted. Score: ${marks}` });

    setTestSummary({ marks, correct, incorrect: total - correct, rank: 'Updating...' });
    setActiveTest(null);
    fetchData();
  };

  const sendQuestion = async () => {
    if (!chatMessage.trim()) return;
    const { error } = await supabase.from('class_messages').insert({ student_id: user.id, student_name: profile?.full_name, message: chatMessage, sender_role: 'student' });
    if (!error) toast.success('Question sent to admin');
    setChatMessage('');
  };

  const embedLink = useMemo(() => {
    if (!liveClass?.link) return '';
    if (liveClass.link.includes('youtube.com') || liveClass.link.includes('youtu.be')) {
      const id = liveClass.youtube_id || liveClass.link.split('v=')[1]?.split('&')[0] || liveClass.link.split('/').pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    return liveClass.link;
  }, [liveClass]);

  return (
    <div className="min-h-screen page-fade text-slate-100">
      <PortalNavbar
        links={[{ key: 'home', label: 'Home' }, { key: 'scholarships', label: 'Scholarships' }, { key: 'live', label: 'Live Class' }, { key: 'tests', label: 'Weekly Test' }, { key: 'payments', label: 'Payments' }, { key: 'about', label: 'About' }]}
        activeKey={activeTab}
        onNavigate={(key) => setActiveTab(key as TabKey)}
        notifications={notifications}
        hasUnread={hasUnread}
        onLogout={onLogout}
        userName={profile?.full_name}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {activeTab === 'home' && (
          <>
            <GlassCard><h2 className="text-2xl font-bold text-cyan-200">Welcome, {profile?.full_name}</h2><p className="text-slate-300">Track scholarship, tests, and classes in real time.</p></GlassCard>
            <GlassCard>
              <h3 className="mb-4 text-lg font-semibold text-cyan-200">Status Timeline</h3>
              <div className="grid gap-3 md:grid-cols-5">{['Applied', 'Paid', 'Approved', 'Admit Card Ready', 'Result Out'].map((step, i) => (
                <div key={step} className={`rounded-2xl border p-3 text-center ${timeline[i] ? 'border-emerald-300/40 bg-emerald-500/20' : 'border-white/10 bg-white/5'}`}>
                  {timeline[i] ? <CheckCircle2 className="mx-auto text-emerald-300" size={18} /> : <Clock3 className="mx-auto text-slate-400" size={18} />}<p className="mt-2 text-sm">{step}</p>
                </div>))}
              </div>
            </GlassCard>
            <GlassCard><h3 className="mb-3 text-lg font-semibold text-cyan-200">Notice Board</h3><div className="space-y-2">{notifications.map((n) => <div key={n.id} className="rounded-xl bg-white/10 p-3"><p className="font-medium text-cyan-200">{n.title}</p><p>{n.message}</p></div>)}</div></GlassCard>
          </>
        )}

        {activeTab === 'scholarships' && (
          <GlassCard className="space-y-4">
            <h3 className="text-xl font-semibold text-cyan-200">Scholarship Payment & Registration</h3>
            <p>Registration ID: <strong>{scholarshipRecord?.registration_id || 'Not generated yet'}</strong></p>
            <p>Status: <strong className="uppercase">{scholarshipRecord?.status || 'not applied'}</strong> | Payment: <strong>{scholarshipRecord?.payment_status || 'unpaid'}</strong></p>
            <div className="flex flex-wrap gap-3">
              <GlassButton onClick={applyAndPayScholarship}><CreditCard size={16} /> Pay ₹300 & Generate ID</GlassButton>
              <GlassButton variant="secondary" onClick={generateAdmitPdf}><FileText size={16} /> Download Admit Card PDF</GlassButton>
            </div>
          </GlassCard>
        )}

        {activeTab === 'live' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2">
              <h3 className="mb-3 text-xl font-semibold text-cyan-200">Live Class</h3>
              {embedLink ? <iframe src={embedLink} title="Live Class" className="h-[420px] w-full rounded-2xl border border-white/10" allowFullScreen /> : <p>No live class scheduled yet.</p>}
            </GlassCard>
            <GlassCard>
              <h4 className="mb-3 font-semibold text-cyan-200">Ask Question</h4>
              <textarea value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} className="min-h-40 w-full rounded-2xl border border-white/10 bg-white/10 p-3" placeholder="Type your question..." />
              <GlassButton className="mt-3 w-full" onClick={sendQuestion}>Send to Admin</GlassButton>
            </GlassCard>
          </div>
        )}

        {activeTab === 'tests' && (
          <>
            {activeTest ? (
              <GlassCard className="space-y-4">
                <h3 className="text-xl font-semibold text-cyan-200">{activeTest.title}</h3>
                <p>Time Left: {Math.floor(secondsLeft / 60)}:{`${secondsLeft % 60}`.padStart(2, '0')}</p>
                {(activeTest.questions || []).map((q: any, i: number) => (
                  <div key={i} className="rounded-2xl bg-white/10 p-3">
                    <p className="mb-2 font-medium">{i + 1}. {q.question}</p>
                    <div className="grid gap-2">{q.options.map((opt: string, idx: number) => (
                      <button key={idx} onClick={() => setAnswers((p) => ({ ...p, [i]: idx }))} className={`rounded-xl border p-2 text-left ${answers[i] === idx ? 'border-cyan-300 bg-cyan-500/20' : 'border-white/10 bg-white/5'}`}>{opt}</button>
                    ))}</div>
                  </div>
                ))}
                <GlassButton onClick={submitTest}>Submit Test</GlassButton>
              </GlassCard>
            ) : (
              <div className="space-y-4">
                {tests.map((test) => (
                  <GlassCard key={test.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-lg font-semibold">{test.title}</p><p className="text-sm text-slate-300">Fee ₹10 • {test.duration_minutes || 10} min</p></div>
                    {testPayments.has(test.id) ? <GlassButton onClick={() => startTest(test)}><PlayCircle size={16} /> Start Test</GlassButton> : <GlassButton onClick={() => payForTest(test)}><ReceiptIndianRupee size={16} /> Pay to Unlock</GlassButton>}
                  </GlassCard>
                ))}
                {testSummary && <GlassCard><h4 className="text-lg font-semibold text-cyan-200">Performance Summary</h4><p>Marks: {testSummary.marks}</p><p>Correct: {testSummary.correct}</p><p>Incorrect: {testSummary.incorrect}</p><p>Rank: {testSummary.rank}</p></GlassCard>}
                <GlassCard><h4 className="text-lg font-semibold text-cyan-200">Test History</h4>{history.map((h) => <p key={h.id} className="text-sm">{new Date(h.created_at).toLocaleDateString()} - Score {h.score}</p>)}</GlassCard>
              </div>
            )}
          </>
        )}

        {activeTab === 'payments' && (
          <GlassCard>
            <h3 className="mb-3 text-xl font-semibold text-cyan-200">Transaction History</h3>
            <div className="space-y-2">{paymentHistory.map((p) => <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/10 p-3"><span>{p.type}</span><span>₹{p.amount}</span><span className={p.status === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>{p.status}</span></div>)}</div>
          </GlassCard>
        )}

        {activeTab === 'about' && <GlassCard><h3 className="text-xl font-semibold text-cyan-200">About Sangam</h3><p className="text-slate-200">Deep-blue glassmorphism portal with full scholarship, exam, class and test lifecycle.</p></GlassCard>}
      </main>
    </div>
  );
};
