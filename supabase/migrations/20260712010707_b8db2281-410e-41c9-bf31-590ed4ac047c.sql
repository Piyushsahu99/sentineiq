GRANT INSERT ON public.transactions TO authenticated;
CREATE POLICY "transactions analyst insert" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_analyst(auth.uid()));