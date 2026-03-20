# Backup Strategy

## Overview

| Database   | Type       | Host    | Backup Method            | Retention  |
|------------|------------|---------|--------------------------|------------|
| MongoDB    | Self-hosted | VPS     | `mongodump` + gzip       | 30 days    |
| PostgreSQL | Managed    | Neon    | Built-in PITR (managed)  | Per plan   |

---

## 1. MongoDB Backup (Feature Service)

### How it works

The script `ops/db-backup.sh` runs `mongodump` with gzip compression and stores
timestamped snapshots under `/opt/alephdraad/backups/mongodb/`.

Each backup produces a directory like:
```
/opt/alephdraad/backups/mongodb/20260320T020000Z/
└── feature_service_db/
    ├── collection1.bson.gz
    ├── collection1.metadata.json.gz
    └── ...
```

### Configuration

| Variable                      | Default                           | Description                  |
|-------------------------------|-----------------------------------|------------------------------|
| `MONGODB__CONNECTIONSTRING`   | `mongodb://127.0.0.1:27017`       | MongoDB connection URI       |
| `MONGODB__DATABASENAME`       | `feature_service_db`              | Database name to back up     |
| `BACKUP_BASE`                 | `/opt/alephdraad/backups/mongodb`  | Root directory for backups   |
| `BACKUP_RETENTION_DAYS`       | `30`                              | Days to keep old backups     |

Environment variables are loaded from `feature-service/.env` if the file exists.

### Manual backup

```bash
# Full backup
ops/db-backup.sh

# Dry run (no actual backup, just logs what would happen)
ops/db-backup.sh --dry-run

# Custom retention
BACKUP_RETENTION_DAYS=7 ops/db-backup.sh
```

### Automated backup (cron)

Install the cron job to run daily at 02:00 UTC:

```bash
crontab deploy/cron/aivalid-db-backup.cron
```

Verify it's installed:

```bash
crontab -l
```

> **Note:** If the user already has other crontab entries, merge manually instead
> of replacing. Use `crontab -e` and add the line from the cron file.

### Verify backups are running

```bash
# Check cron log
tail -50 /var/log/aivalid-db-backup.log

# Check latest backup directory
ls -lt /opt/alephdraad/backups/mongodb/ | head -5

# Check backup size
du -sh /opt/alephdraad/backups/mongodb/$(ls -t /opt/alephdraad/backups/mongodb/ | head -1)
```

### Restore procedure

1. **List available backups:**
   ```bash
   ls -lt /opt/alephdraad/backups/mongodb/
   ```

2. **Stop the Feature Service** (recommended to prevent writes during restore):
   ```bash
   sudo systemctl stop feature-service.service
   ```

3. **Restore from a specific backup:**
   ```bash
   # Restore without dropping (merges data)
   ops/db-restore.sh /opt/alephdraad/backups/mongodb/20260320T020000Z

   # Restore with --drop (replaces existing collections)
   ops/db-restore.sh --drop /opt/alephdraad/backups/mongodb/20260320T020000Z
   ```

4. **Restart the Feature Service:**
   ```bash
   sudo systemctl start feature-service.service
   ```

5. **Verify the service is healthy:**
   ```bash
   curl -s http://localhost:5050/health | head
   ```

---

## 2. PostgreSQL on Neon (Market Backend)

### How it works

PostgreSQL is hosted on [Neon](https://neon.tech), which provides built-in
**Point-in-Time Recovery (PITR)**. No backup scripts are needed.

Neon automatically retains a history of all changes. You can restore to any
point in time within your plan's retention window.

### Restore procedure

1. Go to the [Neon Console](https://console.neon.tech)
2. Select the project
3. Navigate to **Branches** → select the branch
4. Click **Restore** and choose a point in time
5. Neon creates a new branch with the restored data
6. Verify the data, then optionally promote the restored branch

### Limitations

- PITR retention depends on your Neon plan (free plan: 24 hours, paid: longer)
- For additional safety, you can create manual branches before risky operations:
  ```
  Neon Console → Branches → Create Branch (from current state)
  ```

---

## 3. Disaster Recovery Checklist

| Step | Action                                               |
|------|------------------------------------------------------|
| 1    | Identify which database is affected (MongoDB or PG)  |
| 2    | For MongoDB: check `/opt/alephdraad/backups/mongodb/` |
| 3    | For PG: check Neon Console for PITR options          |
| 4    | Stop affected service before restoring               |
| 5    | Run restore                                          |
| 6    | Restart service and verify health                    |
| 7    | Check application logs for errors                    |
