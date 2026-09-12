# Monitoring secrets

For production, create a file named `prometheus_metrics_password` in this
directory. It must contain only the plaintext password used by Prometheus to
authenticate to the application server's `/metrics` endpoint.

This password file is ignored by Git. Never commit it.

