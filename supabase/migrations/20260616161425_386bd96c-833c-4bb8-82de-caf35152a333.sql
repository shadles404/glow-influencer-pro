
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + assign admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cats select" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cats insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Cats update" ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Cats delete" ON public.categories FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Influencers
CREATE TYPE public.priority_type AS ENUM ('important', 'second_important', 'third_important');
CREATE TYPE public.influencer_status AS ENUM ('active', 'inactive');

CREATE TABLE public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  product TEXT,
  priority priority_type NOT NULL DEFAULT 'third_important',
  status influencer_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT ALL ON public.influencers TO service_role;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inf select" ON public.influencers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inf insert" ON public.influencers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Inf update" ON public.influencers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Inf delete" ON public.influencers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_influencers_updated BEFORE UPDATE ON public.influencers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Monthly Targets (period is a date, always the first of the month)
CREATE TABLE public.monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  target_videos INTEGER NOT NULL DEFAULT 0,
  completed_videos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(influencer_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_targets TO authenticated;
GRANT ALL ON public.monthly_targets TO service_role;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT select" ON public.monthly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "MT insert" ON public.monthly_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "MT update" ON public.monthly_targets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "MT delete" ON public.monthly_targets FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_mt_updated BEFORE UPDATE ON public.monthly_targets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exp select" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Exp insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Exp update" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exp delete" ON public.expenses FOR DELETE TO authenticated USING (true);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(influencer_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pay select" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pay insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Pay update" ON public.payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Pay delete" ON public.payments FOR DELETE TO authenticated USING (true);

-- Seed categories
INSERT INTO public.categories (name, monthly_budget) VALUES
  ('Balaala', 2000),
  ('Cosmetics', 3000),
  ('Milk', 3500),
  ('Emergency', 1500),
  ('Events', 1000);
