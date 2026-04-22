from collections import deque
from threading import Lock


class SimpleExecutionQueue:
    def __init__(self) -> None:
        self._queue: deque[int] = deque()
        self._lock = Lock()

    def enqueue(self, execution_id: int) -> None:
        with self._lock:
            self._queue.append(execution_id)

    def pop_next(self) -> int | None:
        with self._lock:
            if not self._queue:
                return None
            return self._queue.popleft()

    def snapshot(self) -> list[int]:
        with self._lock:
            return list(self._queue)


execution_queue = SimpleExecutionQueue()

