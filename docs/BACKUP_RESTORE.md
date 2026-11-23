# Backup & Restore

## Automated Backups (Supabase)

Supabase provides daily automated backups for paid plans.

- **Pro plan:** 7-day retention
- **Team plan:** 30-day retention
- **Restore:** Supabase Dashboard → Database → Backups → Restore to point in time

## Manual Backup

### Full Database Dump
```bash
pg_dump -h db.<project>.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

### Per-Tenant Export (via ERP)
Use ERP Settings → Export Data to download CSV/JSON for:
- Customers (with vision profiles)
- Products (with variants)
- Sales (with line items and payments)
- Prescriptions

### Selective Table Backup
```bash
pg_dump -h db.<project>.supabase.co -U postgres -d postgres \
  -t customers -t products -t sales -t sale_lines \
  -f tenant_backup.sql
```

## Restore Procedure

1. **Stop the application** (set maintenance mode if available)
2. **Restore from backup:**
   ```bash
   psql -h db.<project>.supabase.co -U postgres -d postgres < backup.sql
   ```
3. **Verify data integrity:**
   ```bash
   pnpm verify:migrations
   ```
4. **Restart the application**
5. **Notify affected tenants** of the restore

## Disaster Recovery

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | 1 hour |
| RPO (Recovery Point Objective) | 24 hours (daily backups) |
| For critical data | Enable point-in-time recovery (Supabase Pro) |

## Tenant Offboarding

When a tenant cancels:
1. Export all their data (Data Export feature)
2. Provide export in CSV + JSON format
3. Soft-delete tenant record (set `deleted_at = now()`)
4. Hard-delete after 30-day grace period
5. Clean up storage (product images, prescription photos)