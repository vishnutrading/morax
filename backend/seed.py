"""Create the retained fictional QA dataset after migrations.

Run after migrations: `python seed.py`. It resets only MORAX-DEMO and
explicitly named prior automated-test tenants; other organizations are kept.
"""
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import seed_baseline
from app.models import User
from app.services.qa_dataset import reset_and_seed_qa_dataset


if __name__ == "__main__":
    seed_baseline()
    with SessionLocal() as db:
        bootstrap_user = db.scalar(
            select(User).where(User.email == settings.bootstrap_admin_email.lower())
        )
        reset_and_seed_qa_dataset(
            db, bootstrap_admin_id=bootstrap_user.id if bootstrap_user else None
        )
    print("Retained fictional MORAX QA dataset is ready.")
