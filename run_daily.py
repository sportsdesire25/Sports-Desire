import time
import schedule
import logging
from datetime import datetime
from auto_updater import run_update_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] SportsDesire-Scheduler: %(message)s")

def job_wrapper():
    logging.info(f"⏰ CRON TRIGGERED at {datetime.now().strftime('%H:%M:%S')} - Launching automated ingest pipeline...")
    try:
        run_update_pipeline()
        logging.info("✅ Automated job completed successfully!")
    except Exception as e:
        logging.error(f"❌ Error encountered during scheduled scrape job: {e}", exc_info=True)

def main():
    logging.info("🚀 INITIALIZING SPORTS DESIRE AUTOMATION SCHEDULER...")
    
    # Run once immediately upon startup so user can verify action
    logging.info("Executing startup check harvest...")
    job_wrapper()

    # Configure daily automation schedule at 00:05 AM (Midnight)
    schedule.every().day.at("00:05").do(job_wrapper)
    
    logging.info("⏳ Scheduler armed! Waiting in daemon loop for next daily midnight execution (00:05 AM). Press Ctrl+C to exit.")
    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        logging.info("🛑 Scheduler terminated gracefully by user.")

if __name__ == "__main__":
    main()
