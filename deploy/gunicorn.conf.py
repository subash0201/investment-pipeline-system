"""Gunicorn settings for IPTDS. Used by deploy/systemd/iptds.service."""
import multiprocessing
import os

bind = os.environ.get('GUNICORN_BIND', '127.0.0.1:8001')
# 2 x CPU + 1 is the usual starting point; cap it on small VPSs.
workers = int(os.environ.get('GUNICORN_WORKERS', min(multiprocessing.cpu_count() * 2 + 1, 5)))
threads = 2
timeout = 60
graceful_timeout = 30
max_requests = 1000          # recycle workers now and then to keep memory steady
max_requests_jitter = 100
accesslog = '-'              # stdout -> journald
errorlog = '-'
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
forwarded_allow_ips = '127.0.0.1'
