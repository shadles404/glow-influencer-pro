
-- Restrict mutation policies to admins
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('categories','influencers','monthly_targets','expenses','payments')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Read: any authenticated. Write: admin only.
CREATE POLICY "cat_sel" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_mod" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "inf_sel" ON public.influencers FOR SELECT TO authenticated USING (true);
CREATE POLICY "inf_mod" ON public.influencers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "mt_sel" ON public.monthly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "mt_mod" ON public.monthly_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "exp_sel" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "exp_mod" ON public.expenses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "pay_sel" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "pay_mod" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
