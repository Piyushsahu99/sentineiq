-- Explicit INSERT/UPDATE/DELETE policies on user_roles that block direct writes.
-- All role changes MUST go through assign_initial_role (SECURITY DEFINER, first-time only)
-- or service_role (which bypasses RLS). This makes the "no self-assignment" contract
-- explicit in the policy set instead of relying on absence.
DROP POLICY IF EXISTS "user_roles no direct insert" ON public.user_roles;
CREATE POLICY "user_roles no direct insert"
  ON public.user_roles FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "user_roles no direct update" ON public.user_roles;
CREATE POLICY "user_roles no direct update"
  ON public.user_roles FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "user_roles no direct delete" ON public.user_roles;
CREATE POLICY "user_roles no direct delete"
  ON public.user_roles FOR DELETE
  TO anon, authenticated
  USING (false);

-- Belt-and-suspenders: re-revoke EXECUTE on all SECURITY DEFINER helpers
-- from PUBLIC/anon/authenticated. is_analyst stays executable because
-- RLS policies on other tables call it; assign_initial_role stays
-- executable by authenticated because it's the only path for a user to
-- pick their initial role on first sign-in (it self-guards).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_initial_role(public.app_role) FROM PUBLIC, anon;
-- Keep: GRANT EXECUTE ON FUNCTION public.assign_initial_role(app_role) TO authenticated;
-- Keep: GRANT EXECUTE ON FUNCTION public.is_analyst(uuid) TO anon, authenticated; (needed by RLS)
