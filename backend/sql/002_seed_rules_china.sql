-- Seed a published Malaysia export ruleset with China destination policy only.
-- Run after sql/001_rules_schema.sql.

with ruleset as (
  insert into regulatory_rulesets (
    name,
    version,
    jurisdiction,
    status,
    published_at,
    sources
  )
  values (
    'malaysia-export-core',
    '2026.04.23-cn',
    'MY',
    'published',
    now(),
    '[
      {"name":"Malaysia prohibition overview","url":"https://www.customs.gov.my/en/individu/pengembara/prohibition-of-import-and-export"},
      {"name":"Malaysia prohibited export list","url":"https://ezhs.customs.gov.my/public-prob-export"},
      {"name":"Malaysia tariff reference","url":"https://ezhs.customs.gov.my/public-tariff"},
      {"name":"China customs guidance","url":"http://english.customs.gov.cn/service/guide"}
    ]'::jsonb
  )
  on conflict (name, version) do update
  set
    jurisdiction = excluded.jurisdiction,
    status = excluded.status,
    published_at = excluded.published_at,
    sources = excluded.sources,
    updated_at = now()
  returning id
),
rid as (
  select id from ruleset
  union all
  select id from regulatory_rulesets where name = 'malaysia-export-core' and version = '2026.04.23-cn'
  limit 1
)
insert into regulatory_rules (
  ruleset_id,
  layer,
  rule_code,
  title,
  keywords,
  action,
  message,
  permits,
  agencies,
  severity,
  enabled
)
select
  rid.id,
  seed.layer,
  seed.rule_code,
  seed.title,
  seed.keywords,
  seed.action,
  seed.message,
  seed.permits,
  seed.agencies,
  seed.severity,
  true
from rid
cross join (
  values
    (
      'layer1',
      'MY-L1-ARMS',
      'Arms and explosives',
      '["weapon","gun","rifle","ammunition","explosive","grenade","detonator"]'::jsonb,
      'reject',
      'This product is prohibited for export from Malaysia under absolute prohibition.',
      '[]'::jsonb,
      '["Royal Malaysian Customs Department"]'::jsonb,
      10
    ),
    (
      'layer1',
      'MY-L1-NARCOTIC',
      'Narcotics and controlled drugs',
      '["narcotic","opium","meth","heroin","cocaine","drug"]'::jsonb,
      'reject',
      'This product is prohibited for export from Malaysia under absolute prohibition.',
      '[]'::jsonb,
      '["Royal Malaysian Customs Department"]'::jsonb,
      20
    ),
    (
      'layer2',
      'MY-L2-DUALUSE',
      'Strategic or dual-use items',
      '["dual-use","strategic","encryption module","industrial chemical","drone component"]'::jsonb,
      'permit_required',
      'Export licence may be required before shipment.',
      '["Export licence"]'::jsonb,
      '["Royal Malaysian Customs Department"]'::jsonb,
      110
    ),
    (
      'layer2',
      'MY-L2-TELECOM',
      'Telecommunications equipment',
      '["telecom","radio transmitter","satellite modem","wireless transmitter"]'::jsonb,
      'permit_required',
      'Controlled item likely needs regulator approval.',
      '["Technical approval or licence"]'::jsonb,
      '["MCMC","Royal Malaysian Customs Department"]'::jsonb,
      120
    ),
    (
      'layer3',
      'MY-L3-ANIMAL',
      'Animals and animal products',
      '["animal","meat","poultry","fish","dairy","egg","leather","gelatin"]'::jsonb,
      'conditional',
      'Animal-related exports usually require permit and inspection.',
      '["MAQIS permit","Inspection clearance"]'::jsonb,
      '["MAQIS","Royal Malaysian Customs Department"]'::jsonb,
      210
    ),
    (
      'layer3',
      'MY-L3-PLANT',
      'Plants and plant products',
      '["plant","seed","timber","wood","flower","fruit","vegetable","palm"]'::jsonb,
      'conditional',
      'Plant-related exports usually require phytosanitary controls.',
      '["Phytosanitary certificate","Inspection clearance"]'::jsonb,
      '["MAQIS","Department of Agriculture"]'::jsonb,
      220
    ),
    (
      'layer3',
      'MY-L3-FOOD',
      'Food and processed consumables',
      '["food","snack","beverage","supplement","processed food"]'::jsonb,
      'conditional',
      'Food products may require certification and inspection.',
      '["Health or food compliance certificate"]'::jsonb,
      '["Ministry of Health","MAQIS"]'::jsonb,
      230
    ),
    (
      'layer3',
      'MY-L3-WILDLIFE',
      'Wildlife and protected species',
      '["wildlife","ivory","tortoiseshell","endangered","cites"]'::jsonb,
      'conditional',
      'Wildlife-related products require strict permit controls.',
      '["CITES permit","Wildlife authority permit"]'::jsonb,
      '["PERHILITAN","Royal Malaysian Customs Department"]'::jsonb,
      240
    )
) as seed(layer, rule_code, title, keywords, action, message, permits, agencies, severity)
on conflict (ruleset_id, rule_code) do update
set
  layer = excluded.layer,
  title = excluded.title,
  keywords = excluded.keywords,
  action = excluded.action,
  message = excluded.message,
  permits = excluded.permits,
  agencies = excluded.agencies,
  severity = excluded.severity,
  enabled = excluded.enabled,
  updated_at = now();

with rid as (
  select id from regulatory_rulesets where name = 'malaysia-export-core' and version = '2026.04.23-cn' limit 1
)
insert into destination_policies (
  ruleset_id,
  country_code,
  country_name,
  absolute_prohibited_keywords,
  restricted_keywords,
  notes
)
select
  rid.id,
  'CN',
  'China',
  '["hazardous waste","radioactive waste","counterfeit currency"]'::jsonb,
  '["food","animal product","medical device","chemical"]'::jsonb,
  'Check current China customs prohibitions and product-specific registration requirements.'
from rid
on conflict (ruleset_id, country_code) do update
set
  country_name = excluded.country_name,
  absolute_prohibited_keywords = excluded.absolute_prohibited_keywords,
  restricted_keywords = excluded.restricted_keywords,
  notes = excluded.notes,
  updated_at = now();

with rid as (
  select id from regulatory_rulesets where name = 'malaysia-export-core' and version = '2026.04.23-cn' limit 1
)
insert into document_profiles (ruleset_id, profile_key, items)
select rid.id, seed.profile_key, seed.items
from rid
cross join (
  values
    (
      'default_required_documents',
      '["Commercial invoice","Packing list","HS code declaration","Customs export form K2"]'::jsonb
    ),
    (
      'sea_logistics_flow',
      '["Confirm export admissibility and permits","Prepare commercial invoice and packing list","Submit export declaration in myCIEDS","Await Customs risk review and release","Issue draft bill of lading instructions to forwarder","Container handover and port gate-in","Final customs clearance and vessel departure"]'::jsonb
    ),
    (
      'sea_required_documents',
      '["Commercial invoice","Packing list","Export declaration (K2)","Permit or certificate (if applicable)","Shipping instruction","Draft bill of lading"]'::jsonb
    )
) as seed(profile_key, items)
on conflict (ruleset_id, profile_key) do update
set
  items = excluded.items,
  updated_at = now();