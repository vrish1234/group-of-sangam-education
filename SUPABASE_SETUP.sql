-- Run this in your Supabase SQL Editor to fix the "Database error saving new user" error.
-- This script sets up the profiles table and the trigger to sync users from auth.users.

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'student',
  student_id TEXT UNIQUE,
  roll_number TEXT UNIQUE,
  class_level TEXT,
  father_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow the trigger function to insert profiles (Service Role)
-- Note: Triggers run as the owner of the function, usually a superuser/postgres role.

-- 4. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, student_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'student_id'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Create other necessary tables for the app
CREATE TABLE IF NOT EXISTS public.scholarship_configs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scholarship_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  payment_status TEXT DEFAULT 'unpaid',
  status TEXT DEFAULT 'pending',
  fee_paid NUMERIC DEFAULT 0,
  application_status TEXT DEFAULT 'pending',
  data JSONB,
  approved_at TIMESTAMP WITH TIME ZONE,
  signed_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

UPDATE public.notifications SET title = COALESCE(title, 'Admin Notice');
ALTER TABLE public.notifications ALTER COLUMN title SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.online_classes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  fee NUMERIC DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_payments (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'paid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  registration_number BIGINT,
  exam_date DATE,
  exam_centre TEXT,
  exam_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id)
);

CREATE TABLE IF NOT EXISTS public.admit_card_config (
  id INTEGER PRIMARY KEY,
  exam_date DATE,
  exam_centre TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.results (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  subject TEXT NOT NULL,
  marks NUMERIC NOT NULL,
  total_marks NUMERIC NOT NULL,
  semester TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


ALTER TABLE public.scholarship_forms
  ADD COLUMN IF NOT EXISTS registration_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS exam_date DATE,
  ADD COLUMN IF NOT EXISTS exam_centre TEXT;

ALTER TABLE public.admit_cards
  ADD COLUMN IF NOT EXISTS registration_id TEXT;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 10;

ALTER TABLE public.online_classes
  ADD COLUMN IF NOT EXISTS youtube_id TEXT;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS rank INTEGER;

CREATE TABLE IF NOT EXISTS public.class_messages (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  student_name TEXT,
  sender_role TEXT DEFAULT 'student',
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_history (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  correct_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Create Indexes for performance (60,000+ users)
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON public.profiles(roll_number);
CREATE INDEX IF NOT EXISTS idx_scholarship_forms_payment_status ON public.scholarship_forms(payment_status);
CREATE INDEX IF NOT EXISTS idx_scholarship_forms_student_id ON public.scholarship_forms(student_id);
CREATE INDEX IF NOT EXISTS idx_admit_cards_student_id ON public.admit_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_scholarship_forms_registration_id ON public.scholarship_forms(registration_id);
CREATE INDEX IF NOT EXISTS idx_test_payments_student_test ON public.test_payments(student_id, test_id);
