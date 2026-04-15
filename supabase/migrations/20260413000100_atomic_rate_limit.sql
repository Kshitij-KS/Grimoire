create or replace function public.increment_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer
)
returns table (
  allowed boolean,
  count integer,
  "limit" integer
)
language plpgsql
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.rate_limits (user_id, action, date, count)
  values (p_user_id, p_action, current_date, 1)
  on conflict (user_id, action, date)
  do update
    set count = public.rate_limits.count + 1
    where public.rate_limits.count < p_limit
  returning public.rate_limits.count into v_count;

  if v_count is null then
    select rl.count
    into v_count
    from public.rate_limits rl
    where rl.user_id = p_user_id
      and rl.action = p_action
      and rl.date = current_date;

    return query select false, coalesce(v_count, p_limit), p_limit;
    return;
  end if;

  return query select true, v_count, p_limit;
end;
$$;
