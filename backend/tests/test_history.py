"""Task 5: UC-600 View Prediction History."""
EMPTY_MESSAGE = "No prediction history found. Please complete a Risk Assessment."


def assess(client, headers, body):
    response = client.post("/api/predict", json=body, headers=headers)
    assert response.status_code == 201
    return response.get_json()


def test_history_empty_message(client, user_headers):
    response = client.get("/api/history", headers=user_headers)
    assert response.status_code == 200
    assert response.get_json() == {"predictions": [], "message": EMPTY_MESSAGE}


def test_history_lists_newest_first(client, user_headers, fake_llm, valid_input):
    first = assess(client, user_headers, valid_input)
    second = assess(client, user_headers, {**valid_input, "ap_hi": 170})
    items = client.get("/api/history", headers=user_headers).get_json()["predictions"]
    assert [i["prediction_id"] for i in items] == [second["prediction_id"], first["prediction_id"]]
    assert set(items[0]) == {"prediction_id", "prediction_date", "risk_score", "risk_percent", "risk_category"}
    assert items[0]["risk_category"] == second["risk_category"]


def test_history_only_shows_own_records(client, user_headers, make_user, fake_llm, valid_input):
    from app.auth import make_token
    other = {"Authorization": f"Bearer {make_token(make_user('other@test.com'))}"}
    assess(client, other, valid_input)
    assert client.get("/api/history", headers=user_headers).get_json()["predictions"] == []


def test_history_detail_returns_full_result(client, user_headers, fake_llm, valid_input):
    created = assess(client, user_headers, valid_input)
    response = client.get(f"/api/history/{created['prediction_id']}", headers=user_headers)
    assert response.status_code == 200
    detail = response.get_json()
    for key in ("prediction_id", "risk_score", "risk_percent", "risk_category", "inputs", "shap"):
        assert detail[key] == created[key]
    assert detail["narrative"]["text"] == created["narrative"]["text"]
    assert len(detail["shap"]) == 12 and detail["disclaimer"] and detail["prediction_date"]


def test_history_detail_other_users_record_is_404(client, user_headers, make_user, fake_llm, valid_input):
    from app.auth import make_token
    other = {"Authorization": f"Bearer {make_token(make_user('other@test.com'))}"}
    created = assess(client, other, valid_input)
    theirs = client.get(f"/api/history/{created['prediction_id']}", headers=user_headers)
    missing = client.get("/api/history/999999", headers=user_headers)
    assert theirs.status_code == missing.status_code == 404
    assert theirs.get_json() == missing.get_json() == {"error": "Prediction not found."}


def test_history_cannot_delete(client, user_headers, fake_llm, valid_input):
    created = assess(client, user_headers, valid_input)
    assert client.delete(f"/api/history/{created['prediction_id']}", headers=user_headers).status_code == 405


def test_history_requires_general_user(client, admin_headers):
    assert client.get("/api/history").status_code == 401
    assert client.get("/api/history", headers=admin_headers).status_code == 403
