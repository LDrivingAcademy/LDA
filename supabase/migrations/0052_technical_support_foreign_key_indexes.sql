create index if not exists product_feedback_escalated_by_idx
  on public.product_feedback (escalated_by)
  where escalated_by is not null;

create index if not exists technical_incidents_escalated_by_idx
  on public.technical_incidents (escalated_by)
  where escalated_by is not null;

create index if not exists site_health_reports_escalated_by_idx
  on public.site_health_reports (escalated_by)
  where escalated_by is not null;
