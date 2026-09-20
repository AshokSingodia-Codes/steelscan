"""
reset_legacy_users.py — One-off Administrative Script to Reset Insecure Legacy Users

Usage:
    cd backend
    python -m scripts.reset_legacy_users --new-admin-password "<STRONG_PASSWORD>" [--delete-employee]

Description:
    Locates existing 'admin' and 'employee' accounts in the database:
    - Updates 'admin' with the provided new password and sets must_change_password=True.
    - Revokes all active refresh tokens for modified users.
    - Optionally deactivates or removes the legacy default 'employee' account.
"""

import argparse
import sys
from app.database import SessionLocal, User, RefreshToken, india_now
from app.dependencies import hash_password, validate_password, revoke_all_user_refresh_tokens


def main():
    parser = argparse.ArgumentParser(description="STEELSCAN Legacy Account Security Reset")
    parser.add_argument(
        "--new-admin-password",
        required=True,
        help="New strong password for administrator account",
    )
    parser.add_argument(
        "--delete-employee",
        action="store_true",
        help="Deactivate/remove legacy default employee account if present",
    )

    args = parser.parse_args()

    try:
        new_pwd = validate_password(args.new_admin_password)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    db = SessionLocal()
    try:
        # 1. Reset admin account
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            admin.hashed_password = hash_password(new_pwd)
            admin.must_change_password = True
            admin.failed_login_attempts = 0
            admin.locked_until = None
            revoke_all_user_refresh_tokens(admin.id, db)
            print(f"[OK] Administrator account 'admin' updated with new password. (must_change_password=True)")
        else:
            print("[INFO] No legacy 'admin' account found. Creating new admin...")
            admin = User(
                username="admin",
                full_name="System Administrator",
                email="admin@steelscan.local",
                hashed_password=hash_password(new_pwd),
                role="admin",
                is_active=True,
                must_change_password=True,
            )
            db.add(admin)
            print("[OK] Administrator account 'admin' created.")

        # 2. Handle legacy employee account
        employee = db.query(User).filter(User.username == "employee").first()
        if employee:
            if args.delete_employee:
                revoke_all_user_refresh_tokens(employee.id, db)
                db.delete(employee)
                print("[OK] Legacy 'employee' account deleted.")
            else:
                employee.is_active = False
                revoke_all_user_refresh_tokens(employee.id, db)
                print("[OK] Legacy 'employee' account deactivated.")

        db.commit()
        print("\nSecurity reset completed successfully. Legacy credentials neutralized.")
    except Exception as exc:
        db.rollback()
        print(f"Error executing security reset: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
