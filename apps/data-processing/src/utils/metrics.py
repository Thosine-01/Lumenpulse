from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client import start_http_server

# Define simple Prometheus counters
JOBS_RUN_TOTAL = Counter(
    "jobs_run", 
    "Total number of jobs run in the pipeline"
)

API_FAILURES_TOTAL = Counter(
    "api_failures", 
    "Total number of API request failures",
    ["method", "endpoint"]
)

ANOMALIES_DETECTED_TOTAL = Counter(
    "anomalies_detected", 
    "Total number of anomalies detected",
    ["metric_name"]
)

def start_metrics_server(port: int = 9090):
    """Start standalone prometheus metrics server (for background workers)"""
    try:
        start_http_server(port)
    except Exception as e:
        # Ignore if server is already running
        import logging
        logging.getLogger(__name__).warning("Metrics server could not start: %s", e)
