
-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon,
-- keep only the minimum EXECUTE grants required by RLS policies and the app.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_analyst(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_initial_role(public.app_role) FROM PUBLIC, anon;

-- RLS policies reference is_analyst and has_role, so authenticated must retain EXECUTE.
GRANT EXECUTE ON FUNCTION public.is_analyst(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
-- Signed-in users need to claim an initial role once.
GRANT EXECUTE ON FUNCTION public.assign_initial_role(public.app_role) TO authenticated;
-- handle_new_user is fired by an auth trigger under the definer's rights; no client role needs EXECUTE.
