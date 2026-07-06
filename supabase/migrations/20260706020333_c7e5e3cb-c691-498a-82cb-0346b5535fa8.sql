
-- Include all four operating roles in is_analyst so RLS policies grant them access.
CREATE OR REPLACE FUNCTION public.is_analyst(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('soc_analyst','fraud_analyst','risk_manager','executive')
  )
$function$;

-- Allow anon to execute the check so RLS returns empty rows instead of raising
-- "permission denied for function is_analyst" for signed-out visitors. The
-- function is SECURITY DEFINER and returns false for unknown users, so this is safe.
GRANT EXECUTE ON FUNCTION public.is_analyst(uuid) TO anon, authenticated;
