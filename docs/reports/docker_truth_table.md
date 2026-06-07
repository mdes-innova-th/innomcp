# Docker Truth Table Snapshot

Date: 2026-03-04T04:43:00+07:00

| Container                   | Ports            | Status                 |
| :-------------------------- | :--------------- | :--------------------- |
| `innova-bot`                | Restarting       | Flapping/Restarting    |
| `innova-redis`              | 6379/tcp         | Up 3 hours             |
| `mariadb-innomcp`           | 3308 -> 3306/tcp | Up 3 hours             |
| `innomcp-workspace-storage` | 8090 -> 80/tcp   | Up 3 hours (unhealthy) |
| `innomcp-mariadb`           | 3306 -> 3306/tcp | Up 3 hours (healthy)   |
| `innomcp-redis`             | 6379 -> 6379/tcp | Up 3 hours (healthy)   |

**Recommendation:** Look into why `innova-bot` is restarting (likely docker in docker per previous issues) and why `innomcp-workspace-storage` is unhealthy.
