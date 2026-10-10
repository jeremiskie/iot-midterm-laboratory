from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(main.settings, "device_api_key", "test-device-key")
    test_client = TestClient(main.app)
    yield test_client
    main.app.dependency_overrides.clear()


@pytest.fixture
def supabase_mock():
    mock = MagicMock()
    mock.schema.return_value.table.return_value = mock.table
    mock.table.insert.return_value = mock.insert
    mock.table.select.return_value = mock.select
    mock.select.order.return_value = mock.order
    mock.order.limit.return_value = mock.limit
    return mock


def override_supabase(client: TestClient, supabase_mock: MagicMock) -> None:
    main.app.dependency_overrides[main.get_supabase_client] = lambda: supabase_mock


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_telemetry(client: TestClient, supabase_mock: MagicMock) -> None:
    record = {
        "device_id": "sensor-1",
        "temperature": 21.5,
        "humidity": 48.0,
        "motion": False,
    }
    supabase_mock.insert.execute.return_value = SimpleNamespace(data=[record])
    override_supabase(client, supabase_mock)

    response = client.post(
        "/api/telemetry",
        headers={"X-API-Key": "test-device-key"},
        json={
            "deviceId": "sensor-1",
            "temperature": 21.5,
            "humidity": 48,
            "motion": False,
        },
    )

    assert response.status_code == 201
    assert response.json() == record
    supabase_mock.schema.assert_called_once_with("public")
    supabase_mock.schema.return_value.table.assert_called_once_with("telemetry")
    supabase_mock.schema.return_value.table.return_value.insert.assert_called_once_with(
        record
    )


@pytest.mark.parametrize(
    "headers",
    [{}, {"X-API-Key": "incorrect-key"}],
)
def test_create_telemetry_rejects_missing_or_invalid_key(
    client: TestClient,
    supabase_mock: MagicMock,
    headers: dict[str, str],
) -> None:
    override_supabase(client, supabase_mock)

    response = client.post(
        "/api/telemetry",
        headers=headers,
        json={
            "deviceId": "sensor-1",
            "temperature": 21.5,
            "humidity": 48,
            "motion": False,
        },
    )

    assert response.status_code == 401
    supabase_mock.schema.assert_not_called()


def test_create_telemetry_rejects_invalid_payload(
    client: TestClient,
    supabase_mock: MagicMock,
) -> None:
    override_supabase(client, supabase_mock)

    response = client.post(
        "/api/telemetry",
        headers={"X-API-Key": "test-device-key"},
        json={
            "deviceId": "sensor-1",
            "temperature": "not-a-number",
            "humidity": 48,
            "motion": False,
        },
    )

    assert response.status_code == 422


def test_create_telemetry_reports_database_error(
    client: TestClient,
    supabase_mock: MagicMock,
) -> None:
    supabase_mock.insert.execute.side_effect = RuntimeError("database unavailable")
    override_supabase(client, supabase_mock)

    response = client.post(
        "/api/telemetry",
        headers={"X-API-Key": "test-device-key"},
        json={
            "deviceId": "sensor-1",
            "temperature": 21.5,
            "humidity": 48,
            "motion": False,
        },
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to store telemetry"}


def test_get_recent_telemetry(client: TestClient, supabase_mock: MagicMock) -> None:
    records = [
        {
            "device_id": "sensor-1",
            "temperature": 21.5,
            "humidity": 48.0,
            "motion": False,
        }
    ]
    supabase_mock.limit.execute.return_value = SimpleNamespace(data=records)
    override_supabase(client, supabase_mock)

    response = client.get("/api/telemetry")

    assert response.status_code == 200
    assert response.json() == records
    supabase_mock.select.order.assert_called_once_with("created_at", desc=True)
    supabase_mock.order.limit.assert_called_once_with(100)
