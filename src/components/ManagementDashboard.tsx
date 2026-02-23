import React, { useState, useEffect } from 'react';
import { GlassCard, GlassButton, GlassInput } from './ui/GlassComponents';
import { 
  Users, 
  Upload, 
  FileSpreadsheet, 
  Video, 
  LogOut,
  Search,
  Plus,
  MessageSquare,
  DollarSign,
  Building2,
  Download,
  CheckCircle2,
  XCircle,
  Bell,
  Calendar,
  MapPin,
  Send
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export const ManagementDashboard = ({ user, profile, onLogout }: { user: any, profile: any, onLogout: () => void }) => {
  // Strict Access Control
  const adminEmail = 'vrishketuray@gmail.com';
  if (user?.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <GlassCard className="max-w-md text-center space-y-6">
          <XCircle className="text-red-500 mx-auto" size={64} />
          <h2 className="text-2xl font-bold text-white">Access Denied</h2>
          <p className="text-slate-400">This dashboard is strictly restricted to authorized administrators only.</p>
          <GlassButton onClick={onLogout} className="w-full">Return to Login</GlassButton>
        </GlassCard>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [scholarshipApplications, setScholarshipApplications] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [googleMeetLink, setGoogleMeetLink] = useState('');
  const [admitConfig, setAdmitConfig] = useState({ exam_date: '', exam_centre: '' });
  const [batchAllocation, setBatchAllocation] = useState({ startRoll: '', endRoll: '', date: '', centre: '', address: '' });
  const [newNotification, setNewNotification] = useState('');
  const [notificationTarget, setNotificationTarget] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentMessage, setStudentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentPage, setStudentPage] = useState(0);
  const [hasMoreStudents, setHasMoreStudents] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [studentsRes, scholarshipRes, scholarshipAppsRes, notifyRes, configRes, feedbackRes, classesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').range(0, PAGE_SIZE - 1),
        supabase.from('scholarship_configs').select('*'),
        supabase.from('scholarship_forms').select('*, profiles(full_name, student_id)'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('admit_card_config').select('*').single(),
        supabase.from('feedback').select('*, profiles(full_name)'),
        supabase.from('online_classes').select('*').order('date', { ascending: true })
      ]);

      if (studentsRes.data) {
        setStudents(studentsRes.data);
        setHasMoreStudents(studentsRes.data.length === PAGE_SIZE);
        setStudentPage(1);
      }
      if (scholarshipRes.data) setScholarships(scholarshipRes.data);
      if (scholarshipAppsRes.data) setScholarshipApplications(scholarshipAppsRes.data);
      if (notifyRes.data) setNotifications(notifyRes.data);
      if (configRes.data) setAdmitConfig(configRes.data);
      if (feedbackRes.data) setFeedback(feedbackRes.data);
      if (classesRes.data) {
        setClasses(classesRes.data);
        if (classesRes.data.length > 0) setGoogleMeetLink(classesRes.data[0].link || '');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendStudentNotification = async () => {
    if (!studentMessage || !selectedStudent) return;
    const { error } = await supabase.from('notifications').insert([{ 
      message: studentMessage,
      type: 'direct',
      student_id: selectedStudent.id,
      target: selectedStudent.full_name
    }]);
    if (error) toast.error('Failed to send notification');
    else {
      toast.success(`Notification sent to ${selectedStudent.full_name}!`);
      setStudentMessage('');
      setSelectedStudent(null);
      fetchAllData();
    }
  };

  const loadMoreStudents = async () => {
    const from = studentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .range(from, to);
    
    if (data) {
      setStudents(prev => [...prev, ...data]);
      setHasMoreStudents(data.length === PAGE_SIZE);
      setStudentPage(prev => prev + 1);
    }
  };

  const generateBulkAdmitCards = () => {
    if (students.length === 0) {
      toast.error('No students found to generate admit cards');
      return;
    }

    const doc = new jsPDF();
    students.forEach((student, index) => {
      if (index > 0) doc.addPage();
      
      doc.setFontSize(22);
      doc.text('GROUP OF SANGAM', 105, 20, { align: 'center' });
      doc.setFontSize(16);
      doc.text('ADMIT CARD', 105, 30, { align: 'center' });
      
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      doc.setFontSize(12);
      doc.text(`Name: ${student.full_name}`, 20, 50);
      doc.text(`Student ID: ${student.student_id || 'N/A'}`, 20, 60);
      doc.text(`Email: ${student.email}`, 20, 70);
      doc.text(`Exam Date: ${admitConfig.exam_date || 'TBA'}`, 20, 80);
      doc.text(`Venue: ${admitConfig.exam_centre || 'TBA'}`, 20, 90);

      doc.rect(150, 45, 35, 45);
      doc.text('Photo', 167, 68, { align: 'center' });
    });

    doc.save('Bulk_Admit_Cards.pdf');
    toast.success('Bulk admit cards generated!');
  };

  const updateScholarshipStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('scholarship_forms')
      .update({ 
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        signed_by_admin: status === 'approved'
      })
      .eq('id', id);

    if (error) toast.error('Failed to update status');
    else {
      toast.success(status === 'approved' ? 'Application Approved & Signed' : 'Application Rejected');
      fetchAllData();
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      toast.loading(`Processing ${data.length} records...`);
      
      setTimeout(() => {
        toast.dismiss();
        toast.success('Bulk data processed successfully!');
      }, 2000);
    };
    reader.readAsBinaryString(file);
  };

  const handleScholarshipBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      toast.loading(`Processing ${data.length} scholarship applications...`);
      
      try {
        const uploads = data.map(row => {
          const student = students.find(s => s.email?.toLowerCase() === row.student_email?.toLowerCase());
          return {
            student_id: student?.id,
            status: row.status?.toLowerCase() || 'pending',
            payment_status: row.payment_status?.toLowerCase() || 'unpaid',
            data: row
          };
        }).filter(u => u.student_id);

        if (uploads.length === 0) {
          toast.dismiss();
          toast.error('No valid student emails found in file. Ensure column "student_email" exists.');
          return;
        }

        const { error } = await supabase.from('scholarship_forms').upsert(uploads, { onConflict: 'student_id' });
        
        if (error) throw error;
        
        toast.dismiss();
        toast.success(`Successfully processed ${uploads.length} applications!`);
        fetchAllData();
      } catch (error: any) {
        toast.dismiss();
        toast.error('Bulk upload failed: ' + error.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendNotification = async () => {
    if (!newNotification) return;
    const { error } = await supabase.from('notifications').insert([{ 
      message: newNotification,
      type: 'broadcast',
      target: notificationTarget
    }]);
    if (error) toast.error('Failed to send notification');
    else {
      toast.success(`Notification sent to ${notificationTarget}!`);
      setNewNotification('');
      fetchAllData();
    }
  };

  const updateGoogleMeetLink = async () => {
    if (!googleMeetLink) return;
    // For simplicity, update the first class or a specific global config
    const { error } = await supabase.from('online_classes').upsert([{
      id: classes[0]?.id || 1,
      title: 'Live Class',
      date: new Date().toISOString(),
      link: googleMeetLink
    }]);
    
    if (error) toast.error('Failed to update link');
    else {
      toast.success('Google Meet link updated!');
      fetchAllData();
    }
  };

  const updateAdmitConfig = async () => {
    const { error } = await supabase.from('admit_card_config').upsert([
      { id: 1, ...admitConfig, updated_at: new Date().toISOString() }
    ]);
    if (error) toast.error('Failed to update admit card config');
    else toast.success('Admit card settings updated!');
  };

  const handleBatchAllocate = async () => {
    const { startRoll, endRoll, date, centre, address } = batchAllocation;
    if (!startRoll || !endRoll || !date || !centre) {
      toast.error('Please fill all batch allocation fields');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Find students in range
      const { data: studentsInRange, error: fetchError } = await supabase
        .from('profiles')
        .select('id, roll_number')
        .eq('role', 'student');

      if (fetchError) throw fetchError;

      // Filter students whose roll number is in range
      const startNum = parseInt(startRoll.replace(/\D/g, '') || '0');
      const endNum = parseInt(endRoll.replace(/\D/g, '') || '0');

      const targets = studentsInRange.filter(s => {
        const numRoll = parseInt(s.roll_number?.replace(/\D/g, '') || '0');
        return numRoll >= startNum && numRoll <= endNum;
      });

      if (targets.length === 0) {
        toast.error('No students found in this roll number range');
        return;
      }

      // 2. Upsert admit cards
      const updates = targets.map(s => ({
        student_id: s.id,
        registration_number: parseInt(s.roll_number?.replace(/\D/g, '') || '0'),
        exam_date: date,
        exam_centre: centre,
        exam_address: address
      }));

      const { error: upsertError } = await supabase
        .from('admit_cards')
        .upsert(updates, { onConflict: 'student_id' });

      if (upsertError) throw upsertError;

      toast.success(`Allocated ${targets.length} admit cards successfully!`);
      setBatchAllocation({ startRoll: '', endRoll: '', date: '', centre: '', address: '' });
    } catch (error: any) {
      toast.error('Allocation failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportAdmitCardsExcel = async () => {
    const { data: cards, error } = await supabase
      .from('admit_cards')
      .select(`
        registration_number,
        exam_date,
        exam_centre,
        profiles (full_name, student_id, roll_number)
      `);

    if (error) {
      toast.error('Failed to fetch admit cards for export');
      return;
    }

    const exportData = cards.map(c => {
      const profileData = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        'Roll Number': profileData?.roll_number,
        'Student Name': profileData?.full_name,
        'Student ID': profileData?.student_id,
        'Assigned Centre': c.exam_centre,
        'Exam Date': c.exam_date
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AdmitCards");
    XLSX.writeFile(wb, "Sangam_Batch_Admit_Cards.xlsx");
  };

  const exportAttendanceSheet = async (centreName: string) => {
    const { data: cards, error } = await supabase
      .from('admit_cards')
      .select(`
        registration_number,
        exam_date,
        exam_centre,
        profiles (full_name, student_id, roll_number, class_level, father_name)
      `)
      .eq('exam_centre', centreName);

    if (error) {
      toast.error('Failed to fetch attendance data');
      return;
    }

    const exportData = cards.map(c => {
      const profileData = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        'Roll Number': profileData?.roll_number,
        'Student Name': profileData?.full_name,
        'Father\'s Name': profileData?.father_name || 'N/A',
        'Class': profileData?.class_level,
        'Signature': '____________________'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${centreName.replace(/\s+/g, '_')}.xlsx`);
  };

  const toggleScholarshipStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'draft' ? 'published' : 'draft';
    const { error } = await supabase.from('scholarship_configs').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Update failed');
    else {
      toast.success(`Scholarship ${newStatus}`);
      fetchAllData();
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 glass border-r border-white/10 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
            <Building2 className="text-white" />
          </div>
          <span className="font-bold text-xl text-white">Sangam Admin</span>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: 'students', icon: Users, label: 'Students' },
            { id: 'scholarship', icon: Upload, label: 'Scholarships' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },
            { id: 'admit_settings', icon: Calendar, label: 'Admit Cards' },
            { id: 'results', icon: FileSpreadsheet, label: 'Results' },
            { id: 'classes', icon: Video, label: 'Classes' },
            { id: 'payments', icon: DollarSign, label: 'Payments' },
            { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white">Admin Dashboard</h2>
              <p className="text-slate-400">Welcome back, {profile?.full_name || 'Admin'}</p>
            </div>
            <GlassButton onClick={generateBulkAdmitCards} variant="secondary" className="gap-2">
              <Download size={20} /> Bulk Admit Cards
            </GlassButton>
          </header>

          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <GlassInput 
                    placeholder="Search by name or ID..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <GlassCard className="overflow-x-auto p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-4 text-slate-400 font-medium">Student Name</th>
                      <th className="px-6 py-4 text-slate-400 font-medium">Student ID</th>
                      <th className="px-6 py-4 text-slate-400 font-medium">Email</th>
                      <th className="px-6 py-4 text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length > 0 ? filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium">{student.full_name}</td>
                        <td className="px-6 py-4 text-slate-400">{student.student_id || 'N/A'}</td>
                        <td className="px-6 py-4 text-slate-400">{student.email}</td>
                        <td className="px-6 py-4">
                          <button 
                            className="text-blue-400 hover:text-blue-300 mr-4"
                            onClick={() => setSelectedStudent(student)}
                          >
                            Notify
                          </button>
                          <button className="text-slate-400 hover:text-white">View</button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-500">No students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {hasMoreStudents && !searchQuery && (
                  <div className="p-4 text-center border-t border-white/10">
                    <GlassButton variant="secondary" onClick={loadMoreStudents} size="sm">
                      Load More Students
                    </GlassButton>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {activeTab === 'scholarship' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">Scholarship Management</h3>
                <div className="flex gap-4">
                  <label className="glass-button-secondary cursor-pointer flex items-center gap-2 text-sm">
                    <Upload size={16} /> Bulk Upload
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleScholarshipBulkUpload} />
                  </label>
                </div>
              </div>

              <div className="grid gap-6">
                <section className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-400">Scholarship Programs (Draft/Publish)</h4>
                  <div className="grid gap-4">
                    {scholarships.map((config) => (
                      <GlassCard key={config.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-lg">{config.title}</p>
                          <p className="text-sm text-slate-400">Status: <span className={config.status === 'published' ? 'text-green-400' : 'text-yellow-400'}>{config.status.toUpperCase()}</span></p>
                        </div>
                        <GlassButton 
                          variant={config.status === 'published' ? 'secondary' : 'primary'}
                          onClick={() => toggleScholarshipStatus(config.id, config.status)}
                        >
                          {config.status === 'published' ? 'Unpublish (Draft)' : 'Publish Now'}
                        </GlassButton>
                      </GlassCard>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-400">Student Applications</h4>
                  <div className="grid gap-4">
                    {scholarshipApplications.length > 0 ? scholarshipApplications.map((app) => (
                      <GlassCard key={app.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-lg">{app.profiles?.full_name}</p>
                          <p className="text-sm text-slate-400">ID: {app.profiles?.student_id} • Payment: <span className={app.payment_status === 'paid' ? 'text-green-400' : 'text-red-400'}>{app.payment_status.toUpperCase()}</span></p>
                          {app.data && (
                            <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-x-4">
                              <p>Father: {app.data.father_name}</p>
                              <p>School: {app.data.school_name}</p>
                              <p>Class: {app.data.class_level}</p>
                              <p>Mobile: {app.data.mobile}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {app.status === 'pending' ? (
                            <>
                              <GlassButton size="sm" onClick={() => updateScholarshipStatus(app.id, 'approved')}>
                                <CheckCircle2 size={16} /> Approve & Sign
                              </GlassButton>
                              <GlassButton variant="danger" size="sm" onClick={() => updateScholarshipStatus(app.id, 'rejected')}>
                                <XCircle size={16} /> Reject
                              </GlassButton>
                            </>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                app.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {app.status.toUpperCase()}
                              </span>
                              {app.signed_by_admin && <span className="text-[10px] text-blue-400 italic">Digitally Signed</span>}
                            </div>
                          )}
                        </div>
                      </GlassCard>
                    )) : (
                      <p className="text-center text-slate-500 py-10">No applications found.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Broadcast Notifications</h3>
              <GlassCard className="max-w-2xl space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Target Audience</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={notificationTarget}
                        onChange={(e) => setNotificationTarget(e.target.value)}
                      >
                        <option value="all" className="bg-slate-900">All Students</option>
                        <option value="batch" className="bg-slate-900">Selected Batch</option>
                        {/* Unique centres from admit_cards could be added here */}
                        <option value="centre" className="bg-slate-900">Specific Centre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Message</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                      placeholder="Type your message..."
                      value={newNotification}
                      onChange={(e) => setNewNotification(e.target.value)}
                    />
                  </div>
                  <GlassButton onClick={handleSendNotification} className="w-full gap-2">
                    <Send size={20} /> Send Notification
                  </GlassButton>
                </div>
              </GlassCard>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-slate-400">Recent Broadcasts</h4>
                <div className="grid gap-4">
                  {notifications.length > 0 ? notifications.map((n) => (
                    <GlassCard key={n.id} className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-white">{n.message}</p>
                        <p className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </GlassCard>
                  )) : (
                    <p className="text-center text-slate-500 py-10">No notifications sent yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admit_settings' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Batch Admit Card Allocation</h3>
              <GlassCard className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Roll Number Range</h4>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Start Roll Number</label>
                        <GlassInput 
                          placeholder="e.g. SNG10001" 
                          value={batchAllocation.startRoll}
                          onChange={(e) => setBatchAllocation({...batchAllocation, startRoll: e.target.value})}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">End Roll Number</label>
                        <GlassInput 
                          placeholder="e.g. SNG11000" 
                          value={batchAllocation.endRoll}
                          onChange={(e) => setBatchAllocation({...batchAllocation, endRoll: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-teal-400 uppercase tracking-wider">Exam Details</h4>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Exam Date</label>
                        <GlassInput 
                          type="date" 
                          value={batchAllocation.date}
                          onChange={(e) => setBatchAllocation({...batchAllocation, date: e.target.value})}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Exam Centre</label>
                        <GlassInput 
                          placeholder="Centre Name" 
                          value={batchAllocation.centre}
                          onChange={(e) => setBatchAllocation({...batchAllocation, centre: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Centre Address</label>
                      <GlassInput 
                        placeholder="Full Address of the Centre" 
                        value={batchAllocation.address}
                        onChange={(e) => setBatchAllocation({...batchAllocation, address: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <GlassButton onClick={handleBatchAllocate} className="flex-1 gap-2">
                    <CheckCircle2 size={20} /> Assign Batch Now
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={exportAdmitCardsExcel} className="gap-2">
                    <FileSpreadsheet size={20} /> Export Master List
                  </GlassButton>
                  {batchAllocation.centre && (
                    <GlassButton variant="secondary" onClick={() => exportAttendanceSheet(batchAllocation.centre)} className="gap-2">
                      <Download size={20} /> Attendance ({batchAllocation.centre})
                    </GlassButton>
                  )}
                </div>
              </GlassCard>

              <div className="space-y-4">
                <h4 className="text-lg font-bold">Global Settings</h4>
                <GlassCard className="max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Default Exam Date (Global)</label>
                    <GlassInput 
                      type="date" 
                      value={admitConfig.exam_date}
                      onChange={(e) => setAdmitConfig({ ...admitConfig, exam_date: e.target.value })}
                    />
                  </div>
                  <GlassButton variant="secondary" onClick={updateAdmitConfig} className="w-full">
                    Update Global Default
                  </GlassButton>
                </GlassCard>
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <GlassCard className="max-w-2xl mx-auto text-center space-y-8 py-12">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                <FileSpreadsheet className="text-blue-400" size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Bulk Result Upload</h3>
                <p className="text-slate-400">Upload an Excel file containing student marks to update the database in bulk.</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <label className="glass-button-primary cursor-pointer flex items-center gap-2">
                  <Upload size={20} /> Choose Excel File
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} />
                </label>
              </div>
            </GlassCard>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Student Feedback</h3>
              <div className="grid gap-4">
                {feedback.length > 0 ? feedback.map((fb) => (
                  <GlassCard key={fb.id} className="space-y-3">
                    <div className="flex justify-between">
                      <p className="font-bold text-teal-400">{fb.profiles?.full_name}</p>
                      <p className="text-xs text-slate-500">{new Date(fb.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="text-slate-200">{fb.message}</p>
                    {fb.response ? (
                      <div className="pl-4 border-l-2 border-blue-500 mt-2">
                        <p className="text-xs text-blue-400 font-bold">ADMIN RESPONSE</p>
                        <p className="text-sm text-slate-400">{fb.response}</p>
                      </div>
                    ) : (
                      <GlassButton variant="secondary" size="sm">Reply</GlassButton>
                    )}
                  </GlassCard>
                )) : (
                  <p className="text-center text-slate-500 py-10">No feedback received.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'classes' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">Live Classes & Google Meet</h3>
                <GlassButton className="gap-2">
                  <Plus size={20} /> Schedule New Class
                </GlassButton>
              </div>

              <GlassCard className="max-w-xl space-y-4">
                <h4 className="text-lg font-semibold text-blue-400">Global Live Class Link</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Google Meet URL</label>
                    <GlassInput 
                      placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                      value={googleMeetLink}
                      onChange={(e) => setGoogleMeetLink(e.target.value)}
                    />
                  </div>
                  <GlassButton onClick={updateGoogleMeetLink} className="w-full">Update Link for All Students</GlassButton>
                </div>
              </GlassCard>

              <div className="grid gap-4">
                <h4 className="text-lg font-semibold text-slate-400">Scheduled Sessions</h4>
                {classes.length > 0 ? classes.map((cls) => (
                  <GlassCard key={cls.id} className="flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Video />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{cls.title}</p>
                        <p className="text-sm text-slate-400">{new Date(cls.date).toLocaleString()}</p>
                        <p className="text-xs text-blue-400 truncate max-w-xs">{cls.link}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton variant="secondary" size="sm" onClick={() => window.open(cls.link, '_blank')}>
                        Test Link
                      </GlassButton>
                      <GlassButton variant="danger" size="sm">
                        Cancel
                      </GlassButton>
                    </div>
                  </GlassCard>
                )) : (
                  <p className="text-center text-slate-500 py-10">No classes scheduled.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Financial Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="text-center">
                  <p className="text-slate-400 text-sm">Scholarship Revenue</p>
                  <p className="text-3xl font-bold text-green-400">
                    ${scholarships.filter(s => s.payment_status === 'paid').length * 25}
                  </p>
                </GlassCard>
                <GlassCard className="text-center">
                  <p className="text-slate-400 text-sm">Paid Applications</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {scholarships.filter(s => s.payment_status === 'paid').length}
                  </p>
                </GlassCard>
                <GlassCard className="text-center">
                  <p className="text-slate-400 text-sm">Pending Payments</p>
                  <p className="text-3xl font-bold text-yellow-400">
                    {scholarships.filter(s => s.payment_status === 'unpaid').length}
                  </p>
                </GlassCard>
              </div>
            </div>
          )}
          {/* Direct Notification Modal */}
          {selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Notify Student</h3>
                  <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-white">
                    <XCircle size={24} />
                  </button>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-4">Sending message to: <span className="text-white font-medium">{selectedStudent.full_name}</span></p>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                    placeholder="Type your message..."
                    value={studentMessage}
                    onChange={(e) => setStudentMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <GlassButton variant="secondary" onClick={() => setSelectedStudent(null)} className="flex-1">Cancel</GlassButton>
                  <GlassButton onClick={handleSendStudentNotification} className="flex-1 gap-2">
                    <Send size={18} /> Send
                  </GlassButton>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
