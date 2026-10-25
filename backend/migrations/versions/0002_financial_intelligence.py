"""Persist financial intelligence scenarios, goals, rules, and reviews."""

from alembic import op
import sqlalchemy as sa


revision = "0002_financial_intelligence"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_scenarios",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_financial_scenarios_user_id", "financial_scenarios", ["user_id"])
    op.create_table(
        "life_goals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_life_goals_user_id", "life_goals", ["user_id"])
    op.create_table(
        "goal_contributions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("goal_id", sa.String(length=36), sa.ForeignKey("life_goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("contributed_at", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=250), nullable=False),
    )
    op.create_index("ix_goal_contributions_user_id", "goal_contributions", ["user_id"])
    op.create_index("ix_goal_contributions_goal_id", "goal_contributions", ["goal_id"])
    op.create_table(
        "financial_rules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("condition_type", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=True),
        sa.Column("threshold", sa.Numeric(14, 2), nullable=False),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_financial_rules_user_id", "financial_rules", ["user_id"])
    op.create_table(
        "financial_rule_triggers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", sa.String(length=36), sa.ForeignKey("financial_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rule_id", "fingerprint", name="uq_rule_trigger_fingerprint"),
    )
    op.create_index("ix_financial_rule_triggers_user_id", "financial_rule_triggers", ["user_id"])
    op.create_index("ix_financial_rule_triggers_rule_id", "financial_rule_triggers", ["rule_id"])
    op.create_table(
        "price_change_reviews",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("observation_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("corrected_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("note", sa.String(length=250), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "observation_key", name="uq_price_review_observation"),
    )
    op.create_index("ix_price_change_reviews_user_id", "price_change_reviews", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_price_change_reviews_user_id", table_name="price_change_reviews")
    op.drop_table("price_change_reviews")
    op.drop_index("ix_financial_rule_triggers_rule_id", table_name="financial_rule_triggers")
    op.drop_index("ix_financial_rule_triggers_user_id", table_name="financial_rule_triggers")
    op.drop_table("financial_rule_triggers")
    op.drop_index("ix_financial_rules_user_id", table_name="financial_rules")
    op.drop_table("financial_rules")
    op.drop_index("ix_goal_contributions_goal_id", table_name="goal_contributions")
    op.drop_index("ix_goal_contributions_user_id", table_name="goal_contributions")
    op.drop_table("goal_contributions")
    op.drop_index("ix_life_goals_user_id", table_name="life_goals")
    op.drop_table("life_goals")
    op.drop_index("ix_financial_scenarios_user_id", table_name="financial_scenarios")
    op.drop_table("financial_scenarios")