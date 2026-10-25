"""Create user, session, and transaction tables."""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "login_sessions",
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("csrf_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ref", sa.String(length=32), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("merchant", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("account_id", sa.String(length=100), nullable=False),
        sa.Column("account_name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("reviewed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])
    op.create_index("ix_transactions_user_date", "transactions", ["user_id", "date"])
    op.create_table(
        "budgets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("limit", sa.Numeric(14, 2), nullable=False),
        sa.UniqueConstraint("user_id", "category", name="uq_budgets_user_category"),
    )
    op.create_index("ix_budgets_user_id", "budgets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_budgets_user_id", table_name="budgets")
    op.drop_table("budgets")
    op.drop_index("ix_transactions_user_date", table_name="transactions")
    op.drop_index("ix_transactions_user_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("ix_login_sessions_user_id", table_name="login_sessions")
    op.drop_table("login_sessions")
    op.drop_table("users")