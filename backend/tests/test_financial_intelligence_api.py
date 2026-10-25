import os
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///./ledgevue_test.db")

from app.main import (
    APP_ORIGINS,
    Base,
    FinancialScenarioRecord,
    LoginSession,
    TransactionRecord,
    User,
    app,
    digest,
    get_db,
)


class FinancialIntelligenceApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.session_factory()
        self.user_id = str(uuid.uuid4())
        self.user = User(
            id=self.user_id,
            name="Test User",
            email=f"{self.user_id}@example.test",
            password_hash="unused-test-hash",
        )
        self.session_token = f"session-{uuid.uuid4()}"
        self.csrf_token = f"csrf-{uuid.uuid4()}"
        self.db.add_all(
            [
                self.user,
                LoginSession(
                    token_hash=digest(self.session_token),
                    csrf_hash=digest(self.csrf_token),
                    user_id=self.user_id,
                    expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                ),
            ]
        )
        self.expense_ids: list[str] = []
        self._seed_financial_history()
        self.db.commit()

        if not APP_ORIGINS:
            APP_ORIGINS.add("http://testserver")
        self.origin = sorted(APP_ORIGINS)[0]

        def override_get_db():
            with self.session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app, base_url="http://127.0.0.1:8080")
        self.client.cookies.set("ledgevue_session", self.session_token)
        self.client.cookies.set("ledgevue_csrf", self.csrf_token)
        self.headers = {
            "Origin": self.origin,
            "X-CSRF-Token": self.csrf_token,
        }

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.pop(get_db, None)
        self.db.close()
        self.engine.dispose()

    def _add_transaction(
        self,
        tx_date: date,
        merchant: str,
        amount: str,
        tx_type: str,
        category: str,
    ) -> str:
        transaction_id = str(uuid.uuid4())
        self.db.add(
            TransactionRecord(
                id=transaction_id,
                user_id=self.user_id,
                ref=transaction_id[:32],
                date=tx_date,
                merchant=merchant,
                description=merchant,
                amount=Decimal(amount),
                type=tx_type,
                account_id="test-account",
                account_name="Test account",
                category=category,
                reviewed=False,
                created_at=datetime.now(timezone.utc),
            )
        )
        if tx_type == "expense":
            self.expense_ids.append(transaction_id)
        return transaction_id

    def _seed_financial_history(self):
        today = date.today()
        for days_ago, salary, groceries in (
            (75, "50000", "5000"),
            (45, "50000", "7000"),
            (15, "50000", "4000"),
        ):
            tx_date = today - timedelta(days=days_ago)
            self._add_transaction(tx_date, "Monthly salary", salary, "income", "Salary")
            self._add_transaction(tx_date + timedelta(days=1), "Grocery store", groceries, "expense", "Groceries")
            self._add_transaction(tx_date + timedelta(days=2), "Gym membership", "1200", "expense", "Subscriptions")

        for days_ago, amount, merchant in (
            (75, "499", "Cloud-Storage Subscription"),
            (45, "499", "Cloud Storage payment"),
            (15, "649", "Cloud Storage"),
        ):
            self._add_transaction(
                today - timedelta(days=days_ago),
                merchant,
                amount,
                "expense",
                "Subscriptions",
            )

    def test_five_financial_intelligence_features_with_sample_history(self):
        today = date.today()

        purchase_response = self.client.post(
            "/api/intelligence/purchase-impact",
            headers=self.headers,
            json={
                "title": "Laptop comparison",
                "amount": 10000,
                "category": "Shopping",
                "purchase_date": (today + timedelta(days=1)).isoformat(),
                "horizon_months": 2,
                "minimum_buffer": 5000,
                "save": True,
            },
        )
        self.assertEqual(purchase_response.status_code, 200, purchase_response.text)
        purchase = purchase_response.json()
        self.assertEqual(purchase["signal"], "Within Plan")
        self.assertIsNotNone(purchase["availableFunds"])
        self.assertGreater(purchase["upcomingBills"], 0)
        self.assertTrue(purchase.get("scenarioId"))

        intelligence_response = self.client.get(
            "/api/finance/intelligence", headers={"Origin": self.origin}
        )
        if intelligence_response.status_code == 404:
            intelligence_response = self.client.get(
                "/api/intelligence", headers={"Origin": self.origin}
            )
        self.assertEqual(intelligence_response.status_code, 200, intelligence_response.text)
        intelligence = intelligence_response.json()
        changes = intelligence["priceCreep"]
        self.assertTrue(changes, "Expected a possible recurring-charge change from the sample history")
        change = next(item for item in changes if item["merchant"] == "Cloud Storage")
        self.assertEqual(change["previousAmount"], 499)
        self.assertEqual(change["newAmount"], 649)
        review_response = self.client.patch(
            f"/api/intelligence/price-changes/{change['observationKey']}/review",
            headers=self.headers,
            json={"status": "corrected", "corrected_amount": 599, "note": "Test correction"},
        )
        self.assertEqual(review_response.status_code, 200, review_response.text)
        reviewed_intelligence = self.client.get(
            "/api/finance/intelligence", headers={"Origin": self.origin}
        )
        if reviewed_intelligence.status_code == 404:
            reviewed_intelligence = self.client.get(
                "/api/intelligence", headers={"Origin": self.origin}
            )
        self.assertEqual(reviewed_intelligence.status_code, 200)
        corrected = next(
            item
            for item in reviewed_intelligence.json()["priceCreep"]
            if item["observationKey"] == change["observationKey"]
        )
        self.assertEqual(corrected["newAmount"], 599)
        self.assertEqual(corrected["reviewStatus"], "corrected")

        selected_expense_id = self.expense_ids[0]
        original_amount = self.db.get(TransactionRecord, selected_expense_id).amount
        replay_response = self.client.post(
            "/api/intelligence/replays",
            headers=self.headers,
            json={
                "title": "Replay grocery decision",
                "transaction_id": selected_expense_id,
                "alternative_amount": 1000,
                "monthly_saving": 200,
                "months": 6,
                "save": True,
            },
        )
        self.assertEqual(replay_response.status_code, 201, replay_response.text)
        replay = replay_response.json()["data"]
        self.assertEqual(replay["actualAmount"], float(original_amount))
        self.assertEqual(replay["potentialSavings"], float(original_amount) + 200)
        self.assertIn("No interest", " ".join(replay["assumptions"]))
        self.assertEqual(self.db.get(TransactionRecord, selected_expense_id).amount, original_amount)

        goal_response = self.client.post(
            "/api/intelligence/goals",
            headers=self.headers,
            json={
                "title": "Emergency fund",
                "target_amount": 1200,
                "current_amount": 300,
                "due_date": (today + timedelta(days=120)).isoformat(),
                "priority": "high",
                "status": "active",
            },
        )
        self.assertEqual(goal_response.status_code, 201, goal_response.text)
        goal = goal_response.json()
        self.assertEqual(goal["remainingAmount"], 900)
        self.assertGreater(goal["monthlyTarget"], 0)
        contribution_response = self.client.post(
            f"/api/intelligence/goals/{goal['id']}/contributions",
            headers=self.headers,
            json={"amount": 200, "contributed_at": today.isoformat(), "note": "Test contribution"},
        )
        self.assertEqual(contribution_response.status_code, 201, contribution_response.text)
        self.assertEqual(contribution_response.json()["goal"]["currentAmount"], 500)
        contribution_history = self.client.get(
            f"/api/intelligence/goals/{goal['id']}/contributions",
            headers={"Origin": self.origin},
        )
        self.assertEqual(contribution_history.status_code, 200)
        self.assertEqual(len(contribution_history.json()["items"]), 1)

        rule_response = self.client.post(
            "/api/intelligence/rules",
            headers=self.headers,
            json={
                "name": "Groceries over limit",
                "condition_type": "category_spend",
                "category": "Groceries",
                "threshold": 1,
                "period": "all_history",
                "action": "warn",
                "active": True,
            },
        )
        self.assertEqual(rule_response.status_code, 201, rule_response.text)
        rule = rule_response.json()
        self.assertEqual(rule["conditionType"], "category_spend")
        triggers_response = self.client.get(
            "/api/intelligence/rules/triggers", headers={"Origin": self.origin}
        )
        self.assertEqual(triggers_response.status_code, 200, triggers_response.text)
        triggers = [
            item for item in triggers_response.json()["items"] if item["ruleId"] == rule["id"]
        ]
        self.assertEqual(len(triggers), 1)
        self.assertIn("above", triggers[0]["explanation"])
        self.client.get("/api/intelligence/rules/triggers", headers={"Origin": self.origin})
        triggers_again = self.client.get(
            "/api/intelligence/rules/triggers", headers={"Origin": self.origin}
        ).json()["items"]
        self.assertEqual(
            len([item for item in triggers_again if item["ruleId"] == rule["id"]]), 1
        )
        disabled_rule = self.client.patch(
            f"/api/intelligence/rules/{rule['id']}",
            headers=self.headers,
            json={
                "name": "Groceries over limit",
                "condition_type": "category_spend",
                "category": "Groceries",
                "threshold": 1,
                "period": "all_history",
                "action": "warn",
                "active": False,
            },
        )
        self.assertEqual(disabled_rule.status_code, 200, disabled_rule.text)
        self.assertFalse(disabled_rule.json()["active"])

        scenario_response = self.client.get(
            "/api/intelligence/scenarios?limit=100",
            headers={"Origin": self.origin},
        )
        self.assertEqual(scenario_response.status_code, 200, scenario_response.text)
        saved_kinds = {item["kind"] for item in scenario_response.json()["items"]}
        self.assertTrue({"purchase", "replay"}.issubset(saved_kinds))


if __name__ == "__main__":
    unittest.main()
