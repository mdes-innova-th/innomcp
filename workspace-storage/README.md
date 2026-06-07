# INNOMCP Workspace Storage

Docker-based file storage system for user workspaces.

## Features

- **User-isolated Storage**: Each user gets their own directory
- **Scalable Volumes**: Easy to expand storage capacity
- **HTTP Access**: RESTful file operations via nginx
- **CORS Enabled**: Cross-origin requests supported
- **Health Checks**: Built-in monitoring
- **Auto-indexing**: Directory browsing enabled

## Directory Structure

```
workspace-storage/
├── docker-compose.yml      # Docker configuration
├── nginx.conf              # Nginx configuration
├── data/                   # Storage volume (mounted)
│   └── users/              # User workspaces
│       ├── 1/              # User ID 1
│       │   ├── documents/
│       │   ├── uploads/
│       │   └── exports/
│       ├── 2/              # User ID 2
│       └── ...
└── README.md               # This file
```

## Quick Start

### 1. Start Storage Container

```bash
# From workspace-storage directory
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Create Network (first time only)

```bash
docker network create innomcp-network
```

### 3. Test Access

```bash
# Health check
curl http://localhost:8090/health

# List files
curl http://localhost:8090/

# Create user directory
mkdir -p ./data/users/1/documents
echo "test" > ./data/users/1/documents/test.txt

# Access user file
curl http://localhost:8090/users/1/documents/test.txt
```

## API Endpoints

### Health Check
```
GET /health
Response: 200 "healthy"
```

### List Files
```
GET /users/{userId}/
Response: HTML directory listing
```

### Download File
```
GET /users/{userId}/{path}
Response: File content
```

### Upload File (via backend API)
```
POST /api/workspace/upload
Headers: Authorization: Bearer {token}
Body: multipart/form-data
```

## Volume Management

### Check Volume Size
```bash
docker exec innomcp-workspace-storage df -h /usr/share/nginx/html
```

### Backup Data
```bash
# Full backup
tar -czf workspace-backup-$(date +%Y%m%d).tar.gz ./data/

# Restore backup
tar -xzf workspace-backup-20260106.tar.gz
```

### Expand Volume
```bash
# Stop container
docker-compose down

# Move data to larger disk
rsync -av ./data/ /new-storage/data/

# Update docker-compose.yml volume path
# Start container
docker-compose up -d
```

## Security

### File Permissions
```bash
# Set proper ownership (host)
sudo chown -R 82:82 ./data/users/

# Inside container (nginx user is ID 82)
docker exec innomcp-workspace-storage chown -R nginx:nginx /usr/share/nginx/html/users
```

### Access Control
- All requests require authentication via backend API
- Direct nginx access is restricted to localhost in production
- User can only access their own workspace directory

### Production Configuration
```nginx
# In nginx.conf, add:
location / {
    # Restrict to backend only
    allow 127.0.0.1;
    allow 172.18.0.0/16;  # Docker network
    deny all;
}
```

## Monitoring

### Container Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Nginx access log
docker exec innomcp-workspace-storage tail -f /var/log/nginx/access.log

# Nginx error log
docker exec innomcp-workspace-storage tail -f /var/log/nginx/error.log
```

### Storage Usage
```bash
# Per-user storage
du -sh ./data/users/*

# Total usage
du -sh ./data/
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Check port conflicts
netstat -ano | findstr "8090"

# Rebuild container
docker-compose down
docker-compose up -d --build
```

### Permission denied
```bash
# Fix permissions
docker exec innomcp-workspace-storage chown -R nginx:nginx /usr/share/nginx/html

# Check SELinux (Linux only)
sudo setenforce 0
```

### File not found
```bash
# Check file exists
docker exec innomcp-workspace-storage ls -la /usr/share/nginx/html/users/1/

# Check nginx error log
docker exec innomcp-workspace-storage tail -f /var/log/nginx/error.log
```

## Integration with Backend

### Node.js Example (innomcp-node)

```typescript
import path from 'path';
import fs from 'fs/promises';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/workspace-data/users';

export async function saveUserFile(userId: number, filename: string, content: Buffer) {
  const userDir = path.join(WORKSPACE_ROOT, userId.toString(), 'documents');
  await fs.mkdir(userDir, { recursive: true });
  
  const filePath = path.join(userDir, filename);
  await fs.writeFile(filePath, content);
  
  return {
    path: `/users/${userId}/documents/${filename}`,
    url: `http://localhost:8090/users/${userId}/documents/${filename}`
  };
}

export async function getUserFiles(userId: number, directory: string = 'documents') {
  const userDir = path.join(WORKSPACE_ROOT, userId.toString(), directory);
  const files = await fs.readdir(userDir, { withFileTypes: true });
  
  return files.map(file => ({
    name: file.name,
    isDirectory: file.isDirectory(),
    path: `/users/${userId}/${directory}/${file.name}`
  }));
}
```

### Environment Variables

```env
# innomcp-node/.env
WORKSPACE_ROOT=/path/to/workspace-storage/data
WORKSPACE_URL=http://localhost:8090
```

### Docker Compose Integration

```yaml
# innomcp-node/docker-compose.yml
services:
  innomcp-node:
    volumes:
      - ../workspace-storage/data:/workspace-data:rw
    environment:
      - WORKSPACE_ROOT=/workspace-data/users
    depends_on:
      - workspace-fs
```

## Maintenance

### Daily Tasks
- Monitor storage usage: `du -sh ./data/`
- Check logs for errors: `docker-compose logs --tail=100`
- Verify health: `curl http://localhost:8090/health`

### Weekly Tasks
- Backup data: `tar -czf backup-$(date +%Y%m%d).tar.gz ./data/`
- Clean temp files: `find ./data/users/*/temp -type f -mtime +7 -delete`
- Review access logs: `docker exec innomcp-workspace-storage tail -1000 /var/log/nginx/access.log`

### Monthly Tasks
- Rotate logs: `docker exec innomcp-workspace-storage logrotate /etc/logrotate.conf`
- Update container: `docker-compose pull && docker-compose up -d`
- Audit user storage: Generate usage reports

## Scaling

### Horizontal Scaling
Use S3-compatible storage (MinIO) instead of local volumes:

```yaml
# docker-compose.yml with MinIO
services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
```

### Vertical Scaling
Increase volume size and memory limits:

```yaml
services:
  workspace-fs:
    deploy:
      resources:
        limits:
          memory: 2G
    volumes:
      - type: bind
        source: /mnt/large-disk/workspace-data
        target: /usr/share/nginx/html
```

## License

Part of INNOMCP Project - Ministry of Digital Economy and Society

## Support

For issues, contact: Digital Innovation Division, MDES
