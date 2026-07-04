
-- 1) Tighten profiles SELECT to owner-only
DROP POLICY IF EXISTS "profiles read own or any authed" ON public.profiles;
CREATE POLICY "profiles read own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Fix is_analyst to explicitly check analyst roles
CREATE OR REPLACE FUNCTION public.is_analyst(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('soc_analyst','fraud_analyst')
  )
$$;

-- 3) Remove self-assignment policies on user_roles
DROP POLICY IF EXISTS "roles set own" ON public.user_roles;
DROP POLICY IF EXISTS "roles delete own" ON public.user_roles;

-- 4) Provide a secure, one-time initial role assignment RPC.
--    Users can pick a role only if they don't already have one.
--    Role changes after that must be performed by an admin via service_role.
CREATE OR REPLACE FUNCTION public.assign_initial_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    RAISE EXCEPTION 'role already assigned; contact an administrator to change it';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_initial_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(public.app_role) TO authenticated;
