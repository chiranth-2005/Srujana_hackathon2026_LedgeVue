import os
import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/ledgevue_test")

from app.main import (
    Base,
    FinancialRuleRecord,
    RuleTriggerRecord,
    User,
    _detect_price_creep,
    _evaluate_rules,
    _simulate_purchase_impact,
)


def transaction(identifier: str, day: date, amount: str, kind: str, merchant: str, category: str):
    return SimpleNamespace(
        id=identifier,
        user_id="user-test",
        date=day,
        amount=Decimal(amount),
        type=kind,
        merchant=merchant,
        category=category,
    )


class FinancialIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_purchase_projection_requires_multiple_months_and_income(self):
        result = _simulate_purchase_impact(
            [transaction("income", date(2026, 3, 1), "50000", "income", "Salary", "Salary")],
            Decimal("10000"),
            date(2026, 4, 1),
            3,
            Decimal("5000"),
        )

        self.assertEqual(result["risk"], "Insufficient Data")
        self.assertIsNone(result["projectedBuffer"])
        self.assertIn("Current account balances", result["missingInputs"])

    def test_purchase_projection_without_transactions_returns_insufficient_data(self):
        result = _simulate_purchase_impact(
            [], Decimal("10000"), date(2026, 4, 1), 3, Decimal("5000")
        )

        self.assertEqual(result["signal"], "Insufficient Data")
        self.assertIsNone(result["availableFunds"])
        self.assertIsNone(result["projectedBuffer"])

    def test_purchase_projection_compares_horizon_net_flow_to_buffer(self):
        rows = [
            transaction("salary-1", date(2026, 1, 1), "50000", "income", "Salary", "Salary"),
            transaction("rent-1", date(2026, 1, 5), "20000", "expense", "Rent", "Rent"),
            transaction("salary-2", date(2026, 2, 1), "50000", "income", "Salary", "Salary"),
            transaction("rent-2", date(2026, 2, 5), "20000", "expense", "Rent", "Rent"),
        ]

        result = _simulate_purchase_impact(
            rows, Decimal("35000"), date(2026, 3, 1), 1, Decimal("5000")
        )

        self.assertEqual(result["availableFunds"], 30000)
        self.assertEqual(result["projectedBuffer"], -5000)
        self.assertEqual(result["signal"], "Buffer at Risk")
        self.assertEqual(result["risk"], "Insufficient Data")

    def test_purchase_projection_accounts_for_income_and_upcoming_recurring_bills(self):
        rows = [
            transaction("salary-1", date(2026, 1, 1), "50000", "income", "Salary", "Salary"),
            transaction("food-1", date(2026, 1, 10), "5000", "expense", "Groceries", "Groceries"),
            transaction("cloud-1", date(2026, 1, 5), "1000", "expense", "Cloud plan", "Subscriptions"),
            transaction("salary-2", date(2026, 2, 1), "50000", "income", "Salary", "Salary"),
            transaction("food-2", date(2026, 2, 10), "7000", "expense", "Groceries", "Groceries"),
            transaction("cloud-2", date(2026, 2, 5), "1000", "expense", "Cloud plan", "Subscriptions"),
            transaction("salary-3", date(2026, 3, 1), "50000", "income", "Salary", "Salary"),
            transaction("food-3", date(2026, 3, 10), "4000", "expense", "Groceries", "Groceries"),
            transaction("cloud-3", date(2026, 3, 5), "1000", "expense", "Cloud plan", "Subscriptions"),
        ]

        within_buffer = _simulate_purchase_impact(
            rows, Decimal("80000"), date(2026, 4, 1), 2, Decimal("5000")
        )
        below_buffer = _simulate_purchase_impact(
            rows, Decimal("85000"), date(2026, 4, 1), 2, Decimal("5000")
        )

        self.assertEqual(within_buffer["upcomingBills"], 2000)
        self.assertEqual(within_buffer["availableFunds"], 87333.33)
        self.assertEqual(within_buffer["projectedBuffer"], 7333.33)
        self.assertEqual(within_buffer["signal"], "Within Plan")
        self.assertEqual(below_buffer["projectedBuffer"], 2333.33)
        self.assertEqual(below_buffer["signal"], "Buffer at Risk")

    def test_price_change_matches_normalized_merchant_and_separates_frequency(self):
        rows = [
            transaction("charge-1", date(2026, 1, 5), "499", "expense", "Cloud-Storage Subscription", "Subscriptions"),
            transaction("charge-2", date(2026, 2, 5), "499", "expense", "Cloud Storage payment", "Subscriptions"),
            transaction("charge-3", date(2026, 3, 5), "649", "expense", "Cloud Storage", "Subscriptions"),
            transaction("charge-4", date(2026, 3, 12), "649", "expense", "Cloud Storage", "Subscriptions"),
        ]

        alerts = _detect_price_creep(rows)

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["changeType"], "billing_frequency_change")
        self.assertEqual(alerts[0]["previousFrequency"], "monthly")
        self.assertEqual(alerts[0]["frequency"], "weekly")

    def test_rule_evaluation_is_user_scoped_and_deduplicated(self):
        user = User(id="owner", name="Owner", email="owner@example.test", password_hash="hash")
        other = User(id="other", name="Other", email="other@example.test", password_hash="hash")
        rule = FinancialRuleRecord(
            id="rule-1",
            user_id="owner",
            name="Large expense",
            condition_type="transaction_amount",
            threshold=Decimal("100"),
            period="all_history",
            action="warn",
            active=True,
        )
        self.session.add_all([user, other, rule])
        self.session.commit()
        rows = [
            transaction("large", date.today(), "150", "expense", "Merchant", "Shopping")
        ]

        _evaluate_rules(self.session, "owner", rows)
        _evaluate_rules(self.session, "owner", rows)
        _evaluate_rules(self.session, "other", rows)

        triggers = self.session.scalars(select(RuleTriggerRecord)).all()
        self.assertEqual(len(triggers), 1)
        self.assertEqual(triggers[0].user_id, "owner")
        self.assertEqual(triggers[0].rule_id, "rule-1")


if __name__ == "__main__":
    unittest.main()