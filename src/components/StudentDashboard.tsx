import React, { useState, useEffect } from 'react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { 
  User, 
  FileText, 
  CreditCard, 
  BookOpen, 
  Video, 
  LogOut,
  Download,
  CheckCircle2,
  Clock,
  GraduationCap,
  Bell
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';

export const StudentDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [classes, setClasses] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [scholarshipConfig, setScholarshipConfig] = useState<any>(null);
  const [scholarshipStatus, setScholarshipStatus] = useState<any>(null);
  const [showScholarshipForm, setShowScholarshipForm] = useState(false);
  const [scholarshipFormData, setScholarshipFormData] = useState({
    father_name: '',
    school_name: '',
    class_level: profile?.class_level || '',
    mobile: '',
    address: '',
    photo: null as File | null
  });
  const [admitCard, setAdmitCard] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [paidTests, setPaidTests] = useState<Set<string>>(new Set());
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [classesRes, registrationsRes, notifyRes, scholarshipConfigRes, scholarshipStatusRes, resultsRes, admitCardRes, testsRes, paidTestsRes] = await Promise.all([
        supabase.from('online_classes').select('*').order('date', { ascending: true }),
        supabase.from('class_registrations').select('class_id').eq('student_id', user.id),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('scholarship_configs').select('*').eq('status', 'published').single(),
        supabase.from('scholarship_forms').select('*').eq('student_id', user.id).single(),
        supabase.from('results').select('*').eq('student_id', user.id),
        supabase.from('admit_cards').select('*').eq('student_id', user.id).single(),
        supabase.from('tests').select('*').order('created_at', { ascending: false }),
        supabase.from('test_payments').select('test_id').eq('student_id', user.id)
      ]);

      if (classesRes.data) setClasses(classesRes.data);
      if (registrationsRes.data) setRegistrations(new Set(registrationsRes.data.map(r => r.class_id)));
      
      // Filter notifications based on target
      if (notifyRes.data) {
        const filtered = notifyRes.data.filter((n: any) => {
          if (n.type === 'direct') {
            return n.student_id === user.id;
          }
          if (!n.target || n.target === 'all') return true;
          if (n.target === 'batch') {
            return !!profile.roll_number;
          }
          if (n.target === 'centre') {
            return admitCard?.exam_centre === n.centre_name;
          }
          return true;
        });
        setNotifications(filtered);
      }
      if (scholarshipConfigRes.data) setScholarshipConfig(scholarshipConfigRes.data);
      if (scholarshipStatusRes.data) setScholarshipStatus(scholarshipStatusRes.data);
      if (resultsRes.data) setResults(resultsRes.data);
      if (admitCardRes.data) setAdmitCard(admitCardRes.data);
      if (testsRes.data) setTests(testsRes.data);
      if (paidTestsRes.data) setPaidTests(new Set(paidTestsRes.data.map(p => p.test_id)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScholarshipPayment = async () => {
    // Validation
    if (!scholarshipFormData.father_name || !scholarshipFormData.school_name || !scholarshipFormData.class_level || !scholarshipFormData.mobile || !scholarshipFormData.address || !scholarshipFormData.photo) {
      toast.error('Please fill all mandatory fields and upload a photo.');
      return;
    }

    const classNum = parseInt(scholarshipFormData.class_level.toString());
    if (isNaN(classNum) || classNum < 6 || classNum > 12) {
      toast.error('Eligibility: Only Class 6 to 12 students can apply.');
      return;
    }

    toast.loading('Processing Payment (₹300)...');
    
    // Mock payment success
    setTimeout(async () => {
      try {
        // In a real app, we would upload the photo to storage first
        const photoUrl = "https://picsum.photos/200/200"; // Mock photo URL

        const { error } = await supabase.from('scholarship_forms').upsert({
          student_id: user.id,
          payment_status: 'paid',
          status: 'pending',
          fee_paid: 300,
          application_status: 'pending',
          data: {
            ...scholarshipFormData,
            photo_url: photoUrl,
            student_name: profile.full_name
          }
        });

        if (error) throw error;

        toast.dismiss();
        toast.success('Payment Successful! Form Submitted.');
        setShowScholarshipForm(false);
        generateReceipt();
        fetchData();
      } catch (error: any) {
        toast.dismiss();
        toast.error('Submission failed: ' + error.message);
      }
    }, 2000);
  };

  const generateReceipt = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('SANGAM SCHOLARSHIP RECEIPT', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Receipt No: REC-${Math.floor(Math.random() * 1000000)}`, 20, 40);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
    doc.text(`Student Name: ${profile.full_name}`, 20, 70);
    doc.text(`Class: ${scholarshipFormData.class_level}`, 20, 80);
    doc.text(`Amount Paid: ₹300.00`, 20, 90);
    doc.text(`Payment Status: SUCCESSFUL`, 20, 100);
    
    doc.setLineWidth(0.5);
    doc.line(20, 110, 190, 110);
    doc.text('Thank you for your application!', 105, 120, { align: 'center' });
    
    doc.save(`Scholarship_Receipt_${profile.student_id}.pdf`);
  };

  const handleTestPayment = async (testId: string, fee: number) => {
    toast.loading(`Processing Payment (₹${fee})...`);
    setTimeout(async () => {
      const { error } = await supabase.from('test_payments').insert([{
        student_id: user.id,
        test_id: testId,
        amount: fee,
        status: 'paid'
      }]);
      
      if (error) toast.error('Payment failed');
      else {
        toast.dismiss();
        toast.success('Test Unlocked!');
        fetchData();
      }
    }, 1500);
  };

  const handleRegister = async (classId: string) => {
    try {
      const { error } = await supabase
        .from('class_registrations')
        .insert([{ student_id: user.id, class_id: classId }]);

      if (error) throw error;

      toast.success('Successfully registered for the class!');
      setRegistrations(prev => new Set([...prev, classId]));
    } catch (error: any) {
      toast.error(error.message || 'Failed to register');
    }
  };

  const generateAdmitCard = () => {
    if (!admitCard) {
      toast.error('Admit card not yet allocated.');
      return;
    }

    if (scholarshipStatus?.status !== 'approved' || scholarshipStatus?.payment_status !== 'paid') {
      toast.error('Admit card is locked. Requires Admin Approval and Payment.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('GROUP OF SANGAM', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('ADMIT CARD', 105, 30, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.text(`Name: ${profile.full_name}`, 20, 50);
    doc.text(`Roll Number: ${profile.roll_number || 'N/A'}`, 20, 60);
    doc.text(`Student ID: ${profile.student_id || 'N/A'}`, 20, 70);
    doc.text(`Email: ${profile.email}`, 20, 80);
    doc.text(`Exam Date: ${admitCard.exam_date}`, 20, 90);
    doc.text(`Venue: ${admitCard.exam_centre}`, 20, 100);
    doc.text(`Address: ${admitCard.exam_address || 'N/A'}`, 20, 110);

    doc.rect(150, 45, 35, 45); // Photo box
    doc.text('Photo', 167, 68, { align: 'center' });

    doc.save(`AdmitCard_${profile.student_id}.pdf`);
    toast.success('Admit card downloaded!');
  };

  const handlePayment = async () => {
    // Mock payment integration
    toast.loading('Redirecting to payment gateway...');
    setTimeout(async () => {
      const { error } = await supabase
        .from('scholarship_forms')
        .upsert({ 
          student_id: user.id,
          payment_status: 'paid',
          status: 'pending'
        });
      
      if (error) toast.error('Payment failed');
      else {
        toast.dismiss();
        toast.success('Payment successful!');
        fetchData();
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 glass border-r border-white/10 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
            <GraduationCap className="text-white" />
          </div>
          <span className="font-bold text-xl">Sangam</span>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: 'profile', icon: User, label: 'My Profile' },
            { id: 'updates', icon: Bell, label: 'Updates' },
            { id: 'scholarship', icon: CreditCard, label: 'Scholarship' },
            { id: 'admit', icon: FileText, label: 'Admit Card' },
            { id: 'tests', icon: BookOpen, label: 'Test Series' },
            { id: 'results', icon: GraduationCap, label: 'Results' },
            { id: 'classes', icon: Video, label: 'Classes' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white">Welcome, {profile.full_name.split(' ')[0]}!</h2>
              <p className="text-slate-400">Student Dashboard</p>
            </div>
            <div className="hidden md:block">
              <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">System Online</span>
              </div>
            </div>
          </header>

          {/* Status Tracker */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0" />
              {[
                { label: 'Form', status: scholarshipStatus ? 'complete' : 'pending' },
                { label: 'Payment', status: scholarshipStatus?.payment_status === 'paid' ? 'complete' : 'pending' },
                { label: 'Approval', status: scholarshipStatus?.status === 'approved' ? 'complete' : 'pending' },
                { label: 'Admit Card', status: admitCard ? 'complete' : 'pending' }
              ].map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.status === 'complete' ? 'bg-teal-500 border-teal-500 text-white' : 'bg-slate-900 border-white/20 text-slate-500'
                  }`}>
                    {step.status === 'complete' ? <CheckCircle2 size={20} /> : <span>{i + 1}</span>}
                  </div>
                  <span className={`text-xs font-medium ${step.status === 'complete' ? 'text-teal-400' : 'text-slate-500'}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <User className="text-teal-400" /> Personal Info
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Full Name</span>
                    <span className="text-white font-medium">{profile.full_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Student ID</span>
                    <span className="text-white font-medium">{profile.student_id}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-400">Email</span>
                    <span className="text-white font-medium">{profile.email}</span>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="text-blue-400" /> Recent Activity
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Profile Updated</p>
                      <p className="text-xs text-slate-500">2 hours ago</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">System Updates & Notifications</h3>
              <div className="grid gap-4">
                {notifications.length > 0 ? notifications.map((n) => (
                  <GlassCard key={n.id} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                      <Bell size={20} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-white leading-relaxed">{n.message}</p>
                      <p className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </GlassCard>
                )) : (
                  <p className="text-center text-slate-500 py-10">No updates at this time.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'scholarship' && (
            <div className="space-y-6">
              {!scholarshipConfig && !scholarshipStatus ? (
                <GlassCard className="max-w-2xl mx-auto text-center py-12">
                  <CreditCard className="text-slate-600 mx-auto mb-4" size={48} />
                  <h3 className="text-xl font-bold text-slate-400">No Active Scholarship Programs</h3>
                  <p className="text-slate-500">Please check back later for upcoming scholarship opportunities.</p>
                </GlassCard>
              ) : !showScholarshipForm ? (
                <GlassCard className="max-w-2xl mx-auto text-center space-y-6">
                  <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CreditCard className="text-teal-400" size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">{scholarshipConfig?.title || 'Scholarship Program 2024'}</h3>
                    <p className="text-slate-400">{scholarshipConfig?.description || 'Apply for the Sangam Excellence Scholarship and get up to 100% tuition coverage.'}</p>
                  </div>

                  {!scholarshipStatus ? (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Application fee: ₹300.00</p>
                      <GlassButton onClick={() => setShowScholarshipForm(true)}>Apply Now</GlassButton>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                        <div className="text-left">
                          <p className="font-medium">Status: <span className={scholarshipStatus.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}>{scholarshipStatus.status.toUpperCase()}</span></p>
                          <p className="text-sm text-slate-400">Payment: {scholarshipStatus.payment_status.toUpperCase()}</p>
                          {scholarshipStatus.signed_by_admin && <p className="text-[10px] text-blue-400 italic">Digitally Signed by Admin</p>}
                        </div>
                        {scholarshipStatus.status === 'approved' ? <CheckCircle2 className="text-green-500" /> : <Clock className="text-yellow-500" />}
                      </div>
                      <GlassButton variant="secondary" onClick={generateReceipt}>Download Receipt</GlassButton>
                    </div>
                  )}
                </GlassCard>
              ) : (
                <GlassCard className="max-w-2xl mx-auto space-y-6">
                  <h3 className="text-2xl font-bold text-center">Scholarship Application Form</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Student Name (Mandatory)</label>
                      <GlassInput value={profile.full_name} disabled />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Father's Name (Mandatory)</label>
                      <GlassInput 
                        placeholder="Enter Father's Name" 
                        value={scholarshipFormData.father_name}
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, father_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">School Name (Mandatory)</label>
                      <GlassInput 
                        placeholder="Enter School Name" 
                        value={scholarshipFormData.school_name}
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, school_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Class (6-12 Only)</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={scholarshipFormData.class_level}
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, class_level: e.target.value})}
                      >
                        <option value="" className="bg-slate-900">Select Class</option>
                        {[6,7,8,9,10,11,12].map(c => (
                          <option key={c} value={c} className="bg-slate-900">Class {c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Mobile Number</label>
                      <GlassInput 
                        placeholder="10-digit Mobile" 
                        value={scholarshipFormData.mobile}
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, mobile: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Passport Size Photo</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="text-xs text-slate-400"
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, photo: e.target.files?.[0] || null})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-400 mb-1">Address</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[80px]"
                        placeholder="Full Address"
                        value={scholarshipFormData.address}
                        onChange={(e) => setScholarshipFormData({...scholarshipFormData, address: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <GlassButton variant="secondary" className="flex-1" onClick={() => setShowScholarshipForm(false)}>Cancel</GlassButton>
                    <GlassButton className="flex-1" onClick={handleScholarshipPayment}>Pay ₹300 & Submit</GlassButton>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {activeTab === 'admit' && (
            <GlassCard className="max-w-2xl mx-auto text-center space-y-6">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                <FileText className="text-blue-400" size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Exam Admit Card</h3>
                <p className="text-slate-400">Download your admit card for the upcoming semester examinations.</p>
              </div>
              <GlassButton onClick={generateAdmitCard} className="gap-2">
                <Download size={20} />
                Download PDF
              </GlassButton>
            </GlassCard>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-white">Weekly Test Series</h3>
              <div className="grid gap-4">
                {tests.length > 0 ? tests.map((test) => (
                  <GlassCard key={test.id} className="flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <BookOpen />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{test.title}</p>
                        <p className="text-sm text-slate-400">Fee: ₹{test.fee || 10}</p>
                      </div>
                    </div>
                    <div>
                      {paidTests.has(test.id) ? (
                        <GlassButton size="sm" onClick={() => toast.success('Starting test...')}>
                          Start Test
                        </GlassButton>
                      ) : (
                        <GlassButton size="sm" variant="primary" onClick={() => handleTestPayment(test.id, test.fee || 10)}>
                          Unlock for ₹{test.fee || 10}
                        </GlassButton>
                      )}
                    </div>
                  </GlassCard>
                )) : (
                  <p className="text-center text-slate-500 py-10">No tests available at this time.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Academic Performance</h3>
              <div className="grid gap-4">
                {results.length > 0 ? results.map((result) => (
                  <div key={result.id}>
                    <GlassCard className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-lg">{result.subject}</p>
                        <p className="text-sm text-slate-400">{result.semester}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-400">{result.marks}/{result.total_marks}</p>
                        <p className="text-xs text-slate-500">{(result.marks / result.total_marks * 100).toFixed(1)}%</p>
                      </div>
                    </GlassCard>
                  </div>
                )) : (
                  <p className="text-center text-slate-500 py-10">No results published yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'classes' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Upcoming Online Classes</h3>
              <div className="grid gap-4">
                {classes.length > 0 ? classes.map((cls) => (
                  <div key={cls.id}>
                    <GlassCard className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                          <Video />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{cls.title}</p>
                          <p className="text-sm text-slate-400">{new Date(cls.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {registrations.has(cls.id) ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                            <CheckCircle2 size={16} />
                            Registered
                          </div>
                        ) : (
                          <GlassButton size="sm" onClick={() => handleRegister(cls.id)}>
                            Register Now
                          </GlassButton>
                        )}
                        <GlassButton variant="secondary" size="sm" onClick={() => window.open(cls.link, '_blank')}>
                          Join Class
                        </GlassButton>
                      </div>
                    </GlassCard>
                  </div>
                )) : (
                  <p className="text-center text-slate-500 py-10">No classes scheduled.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
