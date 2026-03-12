# Diagnostic Commands Reference

Generic diagnostic commands organized by category. Use these as a starting point and adapt to the specific application.

## System Health

```bash
# CPU and memory usage
top -l 1 -n 5          # macOS
top -bn1 | head -20    # Linux

# Disk space
df -h

# Memory usage
free -m                # Linux
vm_stat                # macOS

# Network connections
netstat -tuln          # Linux
lsof -i -P             # macOS

# Process inspection
ps aux | grep <process-name>
lsof -p <PID>
```

## Application Logs

```bash
# Tail application logs
tail -f /var/log/app.log

# Search for errors in logs
grep -i "error\|exception\|fatal" /var/log/app.log | tail -50

# Systemd service logs
journalctl -u <service-name> -f
journalctl -u <service-name> --since "1 hour ago"

# Analyze log patterns
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head -20
```

## Database Connectivity

```bash
# PostgreSQL
psql -h <host> -U <user> -d <db> -c "SELECT 1"
psql -h <host> -U <user> -d <db> -c "SELECT count(*) FROM pg_stat_activity"

# MySQL
mysql -u <user> -p -e "SELECT 1"
mysql -u <user> -p -e "SHOW PROCESSLIST"
mysql -u <user> -p -e "SHOW VARIABLES LIKE 'slow_query_log'"

# Redis
redis-cli ping
redis-cli info memory
redis-cli info clients
```

## Network Troubleshooting

```bash
# Test basic connectivity
ping -c 3 <host>
curl -v https://<host>/health

# DNS resolution
nslookup <domain>
dig <domain>

# Check SSL certificate
openssl s_client -connect <host>:443 -servername <host> </dev/null 2>/dev/null | openssl x509 -noout -dates

# Test specific port
nc -zv <host> <port>
```

## Container and Orchestration

```bash
# Docker
docker ps -a
docker logs <container-name> --tail 100
docker stats --no-stream
docker exec -it <container-name> /bin/sh

# Kubernetes
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --tail 100
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

## Application-Specific

### Node.js
```bash
# Check if process is running
pgrep -f "node.*<app-entry>"

# Memory and CPU usage
node -e "console.log(process.memoryUsage())"

# Check event loop lag (requires clinic or similar)
npx clinic doctor -- node <app-entry>
```

### Java
```bash
# Check heap usage
jstat -gc <PID>

# Thread dump
jstack <PID>

# Heap dump
jmap -dump:format=b,file=heapdump.hprof <PID>
```

### Python
```bash
# Check if process is running
pgrep -f "python.*<app-entry>"

# Profile memory
python -m memory_profiler <script.py>
```

## Performance Profiling

```bash
# I/O statistics
iostat -x 1 5

# System activity
sar -u 1 10        # CPU
sar -r 1 10        # Memory
sar -n DEV 1 10    # Network

# Trace system calls
strace -p <PID> -c    # Linux (summary)
dtruss -p <PID>       # macOS
```
