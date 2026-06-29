"""
Database Connection Test Script
Tests PostgreSQL connection from Python model service
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
import traceback

def load_env():
    """Load environment variables from .env file"""
    env_paths = [".env", "../.env", "../../.env"]
    for path in env_paths:
        if os.path.exists(path):
            print(f"✓ Found .env file at: {path}")
            with open(path, "r") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2:
                            key, value = parts[0].strip(), parts[1].strip()
                            os.environ[key] = value
            return True
    print("⚠ No .env file found")
    return False

def test_database_connection():
    """Test PostgreSQL database connection"""
    print("\n" + "="*60)
    print("PostgreSQL Database Connection Test")
    print("="*60 + "\n")

    # Load environment variables
    load_env()

    # Get database credentials
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "autoparts")

    print("Database Configuration:")
    print(f"  Host:     {db_host}")
    print(f"  Port:     {db_port}")
    print(f"  User:     {db_user}")
    print(f"  Password: {'*' * len(db_password) if db_password else '(empty)'}")
    print(f"  Database: {db_name}")
    print()

    # Construct connection string
    connection_string = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    try:
        print("📡 Attempting to connect to database...")
        engine = create_engine(connection_string, echo=False)

        # Test connection
        with engine.connect() as connection:
            print("✓ Successfully connected to database!\n")

            # Test 1: Get PostgreSQL version
            print("Test 1: PostgreSQL Version")
            result = connection.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"  Version: {version.split(',')[0]}")
            print()

            # Test 2: List all tables
            print("Test 2: List Tables")
            result = connection.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """))
            tables = result.fetchall()
            if tables:
                print(f"  Found {len(tables)} table(s):")
                for idx, (table_name,) in enumerate(tables, 1):
                    print(f"    {idx}. {table_name}")
            else:
                print("  ⚠ No tables found (database might be empty)")
            print()

            # Test 3: Check specific tables related to model
            print("Test 3: Check Model-Related Tables")
            model_tables = ['bills', 'bill_items', 'bill_images', 'suppliers', 'products']
            for table in model_tables:
                result = connection.execute(text(f"""
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = '{table}';
                """))
                exists = result.fetchone()[0] > 0
                status = "✓ Exists" if exists else "✗ Not found"
                print(f"  {table:20s} {status}")

                # If table exists, count rows
                if exists:
                    try:
                        result = connection.execute(text(f"SELECT COUNT(*) FROM {table};"))
                        count = result.fetchone()[0]
                        print(f"  {' '*20} └─ {count} row(s)")
                    except Exception as e:
                        print(f"  {' '*20} └─ Error counting: {str(e)}")
            print()

            # Test 4: Check database encoding
            print("Test 4: Database Configuration")
            result = connection.execute(text("SHOW server_encoding;"))
            encoding = result.fetchone()[0]
            print(f"  Encoding: {encoding}")

            result = connection.execute(text("SHOW timezone;"))
            timezone = result.fetchone()[0]
            print(f"  Timezone: {timezone}")
            print()

        print("="*60)
        print("✅ All database tests completed successfully!")
        print("="*60)
        return True

    except OperationalError as e:
        print("\n" + "="*60)
        print("❌ Database Connection Failed!")
        print("="*60)
        print("\nError Details:")
        print(f"  {str(e)}")
        print("\nPossible causes:")
        print("  1. PostgreSQL server is not running")
        print("  2. Wrong host or port")
        print("  3. Invalid username or password")
        print("  4. Database does not exist")
        print("  5. Firewall blocking connection")
        print("\nPlease check your .env file and database configuration.")
        return False

    except Exception as e:
        print("\n" + "="*60)
        print("❌ Unexpected Error!")
        print("="*60)
        print("\nError Details:")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_database_connection()
    sys.exit(0 if success else 1)
