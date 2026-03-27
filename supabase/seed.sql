insert into worlds (id, user_id, name, genre, tone, premise, cover_color, is_demo)
values (
  '00000000-0000-0000-0000-000000000001',
  null,
  'Ashveil',
  'Fantasy',
  'Dark & Gritty',
  'A dying empire clings to its final magical city while old cults and living relics begin to wake.',
  '#7c5cbf',
  true
)
on conflict (id) do nothing;
