export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  student_id?: string;
  contact_info?: string;
  created_at: string;
}

export interface ScholarshipForm {
  id: string;
  student_id: string;
  data: any;
  status: 'pending' | 'approved' | 'rejected';
  payment_status: 'unpaid' | 'paid';
  created_at: string;
}

export interface Result {
  id: string;
  student_id: string;
  subject: string;
  marks: number;
  total_marks: number;
  semester: string;
  created_at: string;
}

export interface OnlineClass {
  id: string;
  title: string;
  description: string;
  link: string;
  date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transaction_id: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  student_id: string;
  message: string;
  response?: string;
  created_at: string;
}
