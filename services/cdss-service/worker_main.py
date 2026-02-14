import signal
import time

from main import _JOB_WORKER_STOP, _start_job_worker


def _stop(*_args):
    _JOB_WORKER_STOP.set()


def main() -> None:
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    _start_job_worker()
    while not _JOB_WORKER_STOP.is_set():
        time.sleep(1)


if __name__ == "__main__":
    main()

