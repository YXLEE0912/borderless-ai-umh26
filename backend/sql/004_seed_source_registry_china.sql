-- Seed registry of authoritative links for Malaysia export and China import checks.
-- Run after sql/003_operational_hardening.sql.

insert into regulatory_source_registry (
  jurisdiction,
  country_code,
  source_type,
  title,
  url,
  authority_name,
  status,
  notes
)
values
  (
    'MY',
    'MY',
    'law',
    'Prohibition of Import and Export (overview)',
    'https://www.customs.gov.my/en/individu/pengembara/prohibition-of-import-and-export',
    'Royal Malaysian Customs Department',
    'active',
    'Primary overview for prohibited and restricted import/export controls.'
  ),
  (
    'MY',
    'MY',
    'law',
    'Malaysia Prohibited Export List',
    'https://ezhs.customs.gov.my/public-prob-export',
    'Royal Malaysian Customs Department',
    'active',
    'Reference list for prohibited exports and licence controls.'
  ),
  (
    'MY',
    'MY',
    'tariff',
    'Malaysia PDK Tariff',
    'https://ezhs.customs.gov.my/public-tariff',
    'Royal Malaysian Customs Department',
    'active',
    'Tariff and local extension over WCO HS baseline.'
  ),
  (
    'MY',
    'MY',
    'procedure',
    'Malaysia Export Procedure',
    'https://www.customs.gov.my/en/business/import-export/export/export-procedure',
    'Royal Malaysian Customs Department',
    'active',
    'Operational procedure for export declaration and release.'
  ),
  (
    'MY',
    'MY',
    'agreement',
    'RCEP Reference (MITI)',
    'https://fta.miti.gov.my/index.php/pages/view/rcep',
    'MITI',
    'active',
    'Trade agreement source for preferential tariff checks.'
  ),
  (
    'CN',
    'CN',
    'law',
    'China Customs Prohibited List',
    'http://english.customs.gov.cn/Statics/a5e61d7c-4818-44c0-96a1-911e060da95c.html',
    'General Administration of Customs of the People''s Republic of China',
    'active',
    'Destination-side prohibited categories for China imports.'
  ),
  (
    'CN',
    'CN',
    'procedure',
    'China Customs Service Guide',
    'http://english.customs.gov.cn/service/guide?c=1972a692-42af-4aab-bf44-36934ead8a81&k=51',
    'General Administration of Customs of the People''s Republic of China',
    'active',
    'Destination-side guidance and related procedures.'
  )
on conflict (url) do update
set
  jurisdiction = excluded.jurisdiction,
  country_code = excluded.country_code,
  source_type = excluded.source_type,
  title = excluded.title,
  authority_name = excluded.authority_name,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();