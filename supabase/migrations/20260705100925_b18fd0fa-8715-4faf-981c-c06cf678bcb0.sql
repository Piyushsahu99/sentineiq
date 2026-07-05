
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_analyst(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- assign_initial_role must remain callable by signed-in users to self-assign a role on first login
REVOKE EXECUTE ON FUNCTION public.assign_initial_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(app_role) TO authenticated;
