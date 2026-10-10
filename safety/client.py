from __future__ import annotations

import json
import socket
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOCKET = ROOT / "safety/runtime/actuator.sock"


class ActuatorClientError(RuntimeError):
    pass


class ActuatorClient:
    def __init__(self, socket_path: Path = DEFAULT_SOCKET, timeout: float = 5):
        self.socket_path = socket_path
        self.timeout = timeout

    def call(self, action: str, **payload: Any) -> dict[str, Any]:
        request = {"action": action, **payload}
        connection = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        connection.settimeout(self.timeout)
        try:
            connection.connect(str(self.socket_path))
            connection.sendall((json.dumps(request) + "\n").encode("utf-8"))
            chunks: list[bytes] = []
            while True:
                chunk = connection.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                if b"\n" in chunk:
                    break
            if not chunks:
                raise ActuatorClientError("Actuator returned an empty response")
            response = json.loads(b"".join(chunks).split(b"\n", 1)[0])
        except (OSError, json.JSONDecodeError) as error:
            raise ActuatorClientError(f"Actuator request failed: {error}") from error
        finally:
            connection.close()
        if not response.get("ok"):
            raise ActuatorClientError(response.get("error", "Unknown actuator error"))
        return response.get("result", {})

    def ping(self) -> dict[str, Any]:
        return self.call("ping")

