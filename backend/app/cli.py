import argparse
import sys
from uuid import UUID
from datetime import datetime, timezone, timedelta

from backend.app.database import SessionLocal
from backend.app.models import MeetingLocation, TransactionAuditLog, PurchaseRequest, Meeting, AuditAction
from backend.app.jobs.scheduler import expire_pending_requests, process_no_shows, send_transaction_reminders
from backend.app.services.audit_logger import log_transaction_event

def handle_run_jobs(args):
    db = SessionLocal()
    try:
        print("Starting background job execution...")
        expired = expire_pending_requests(db)
        print(f"-> Expired pending requests: {expired}")
        
        no_shows = process_no_shows(db)
        print(f"-> Marked no-shows: {no_shows}")
        
        reminders = send_transaction_reminders(db)
        print(f"-> Transaction reminders sent: {reminders}")
        
        print("All background jobs completed successfully.")
    except Exception as e:
        print(f"Error running jobs: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

def handle_locations_list(args, db):
    locations = db.query(MeetingLocation).all()
    if not locations:
        print("No meeting locations found.")
        return
    print(f"{'ID':<36} | {'Name':<25} | {'Active':<6} | {'Description'}")
    print("-" * 90)
    for loc in locations:
        status_str = "Yes" if loc.is_active else "No"
        desc = loc.description or ""
        print(f"{str(loc.id):<36} | {loc.name:<25} | {status_str:<6} | {desc}")

def handle_locations_add(args, db):
    name = args.name.strip()
    if not name:
        print("Error: Location name cannot be empty.", file=sys.stderr)
        sys.exit(1)
        
    existing = db.query(MeetingLocation).filter(MeetingLocation.name == name).first()
    if existing:
        if not existing.is_active or existing.deleted_at is not None:
            existing.is_active = True
            existing.deleted_at = None
            if args.description:
                existing.description = args.description
            db.commit()
            print(f"Re-activated existing location: '{name}' (ID: {existing.id})")
            return
        else:
            print(f"Error: Location '{name}' already exists and is active.", file=sys.stderr)
            sys.exit(1)

    loc = MeetingLocation(
        name=name,
        description=args.description,
        is_active=True
    )
    db.add(loc)
    db.commit()
    print(f"Successfully added new location: '{name}' (ID: {loc.id})")

def handle_locations_delete(args, db):
    target = args.target.strip()
    loc = None
    try:
        uid = UUID(target)
        loc = db.query(MeetingLocation).filter(MeetingLocation.id == uid).first()
    except ValueError:
        loc = db.query(MeetingLocation).filter(MeetingLocation.name == target).first()

    if not loc:
        print(f"Error: Meeting location '{target}' not found.", file=sys.stderr)
        sys.exit(1)

    if not loc.is_active:
        print(f"Location '{loc.name}' is already inactive/deleted.")
        return

    loc.is_active = False
    loc.deleted_at = datetime.now(timezone.utc)
    db.commit()
    print(f"Successfully soft-deleted location: '{loc.name}'")

def handle_locations(args):
    db = SessionLocal()
    try:
        if args.loc_action == 'list':
            handle_locations_list(args, db)
        elif args.loc_action == 'add':
            handle_locations_add(args, db)
        elif args.loc_action == 'delete':
            handle_locations_delete(args, db)
        else:
            print("Error: Unknown locations action.", file=sys.stderr)
            sys.exit(1)
    finally:
        db.close()

def handle_audit_logs(args):
    db = SessionLocal()
    try:
        logs = db.query(TransactionAuditLog).order_by(TransactionAuditLog.created_at.desc()).all()
        if not logs:
            print("No transaction audit logs found.")
            return
        print(f"{'Timestamp':<25} | {'Action':<18} | {'Order ID':<36} | {'Actor ID':<36}")
        print("-" * 125)
        for log in logs:
            ts = log.created_at.isoformat() if log.created_at else ""
            actor = str(log.actor_id) if log.actor_id else "System"
            print(f"{ts:<25} | {log.action_type:<18} | {str(log.purchase_request_id):<36} | {actor:<36}")
    finally:
        db.close()

def handle_override_no_show(args):
    order_id_str = args.order_id.strip()
    try:
        order_id = UUID(order_id_str)
    except ValueError:
        print("Error: Invalid UUID format for order ID.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == order_id).first()
        if not request:
            print(f"Error: Order request '{order_id}' not found.", file=sys.stderr)
            sys.exit(1)

        meeting = request.meeting
        if not meeting:
            print("Error: No meeting associated with this order request.", file=sys.stderr)
            sys.exit(1)

        if meeting.status != "NO_SHOW":
            print(f"Error: Only no-show transactions can be overridden. Current meeting status: {meeting.status}", file=sys.stderr)
            sys.exit(1)

        # Restore statuses
        meeting.status = "SCHEDULED"
        meeting.no_show_marked_at = None
        meeting.confirmation_deadline = datetime.now(timezone.utc) + timedelta(hours=24)

        request.status = "ACCEPTED"
        request.cancelled_at = None
        request.cancelled_by = None
        request.cancel_reason = None

        if request.listing:
            request.listing.status = "reserved"

        # Reset confirmation flags to allow them to re-confirm
        if meeting.confirmation:
            meeting.confirmation.buyer_confirmed = False
            meeting.confirmation.seller_confirmed = False

        # Log Audit Record
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=meeting.id,
            actor_id=None,
            action_type=AuditAction.REQUEST_ACCEPTED,
            old_status="CANCELLED",
            new_status="ACCEPTED",
            metadata={
                "override_by_admin": "CLI",
                "reason": "Administrative Dispute Override via CLI"
            }
        )

        db.commit()
        print(f"Successfully overridden no-show for order '{order_id}'. Meeting reverted to SCHEDULED, order to ACCEPTED.")
    except Exception as e:
        print(f"Error overriding no-show: {e}", file=sys.stderr)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="SemesterSwap Administrative CLI Utility")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # run-jobs subcommand
    subparsers.add_parser("run-jobs", help="Execute all background cron tasks (expiration, no-shows, reminders)")

    # locations subcommand
    loc_parser = subparsers.add_parser("locations", help="Manage meeting locations")
    loc_subparsers = loc_parser.add_subparsers(dest="loc_action", help="Location management action")

    # locations list
    loc_subparsers.add_parser("list", help="List all meeting locations")

    # locations add
    add_parser = loc_subparsers.add_parser("add", help="Add a new meeting location")
    add_parser.add_argument("name", help="Name of the location")
    add_parser.add_argument("--description", "-d", help="Optional description of the location")

    # locations delete
    del_parser = loc_subparsers.add_parser("delete", help="Soft-delete a meeting location")
    del_parser.add_argument("target", help="Name or UUID of the location to delete")

    # audit-logs subcommand
    subparsers.add_parser("audit-logs", help="View all transaction audit logs")

    # override-no-show subcommand
    override_parser = subparsers.add_parser("override-no-show", help="Override incorrect no-show status for an order")
    override_parser.add_argument("order_id", help="UUID of the order/purchase request to override")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "run-jobs":
        handle_run_jobs(args)
    elif args.command == "locations":
        if not args.loc_action:
            loc_parser.print_help()
            sys.exit(1)
        handle_locations(args)
    elif args.command == "audit-logs":
        handle_audit_logs(args)
    elif args.command == "override-no-show":
        handle_override_no_show(args)

if __name__ == "__main__":
    main()
