-- What a monthly check sweeps.
--
-- "18 platforms" is the public simplification. In practice the list mixes real
-- trade platforms, the same underlying data resold under other organizational
-- structures, and viewpoints on how a company appears - so an entry here is
-- "one thing a staffer ticks off", not necessarily a website.
--
-- Only the eight the prototype names are seeded; the rest appear there as
-- "+13 more", which is design filler rather than a list. Complete it from the
-- real checklist with scripts/add-platforms.mjs.
--
-- A monthly run creates one `monitoring_checks` row per active entry here.

insert into platforms (slug, name, sort) values
  ('importyeti',     'ImportYeti',           10),
  ('panjiva',        'Panjiva',              20),
  ('importgenius',   'Import Genius',        30),
  ('importkey',      'ImportKey',            40),
  ('trademo',        'Trademo',              50),
  ('datamyne',       'Descartes Datamyne',   60),
  ('tradesparq',     'Tradesparq',           70),
  ('volza',          'Volza',                80)
on conflict (slug) do nothing;
