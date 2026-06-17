
-- Tighten SELECT policies to admin-only for sensitive tables
DROP POLICY IF EXISTS inf_sel ON public.influencers;
CREATE POLICY inf_sel ON public.influencers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS pay_sel ON public.payments;
CREATE POLICY pay_sel ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS mt_sel ON public.monthly_targets;
CREATE POLICY mt_sel ON public.monthly_targets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS exp_sel ON public.expenses;
CREATE POLICY exp_sel ON public.expenses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cat_sel ON public.categories;
CREATE POLICY cat_sel ON public.categories FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: only own profile
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- user_roles: only own roles
DROP POLICY IF EXISTS "Roles readable by authenticated" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Lock down SECURITY DEFINER functions; keep has_role callable (used in policies as SQL function, runs with definer rights regardless of EXECUTE grants when invoked from policy? Actually policy execution uses the calling role's privileges. Keep EXECUTE for authenticated so policies work, but revoke from anon.)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
