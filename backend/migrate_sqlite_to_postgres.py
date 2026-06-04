import argparse
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

import psycopg


def compact_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def safe_identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value or ""):
        raise ValueError(f"Unsafe SQL identifier: {value!r}")
    return value


def sqlite_create_to_postgres(sql: str) -> str:
    translated = compact_text(sql)
    translated = re.sub(r"\bAUTOINCREMENT\b", "", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bINTEGER\s+PRIMARY\s+KEY\b", "INTEGER PRIMARY KEY", translated, flags=re.IGNORECASE)
    return translated


def table_columns(connection: sqlite3.Connection, table_name: str) -> list[str]:
    return [str(row["name"]) for row in connection.execute(f"PRAGMA table_info({safe_identifier(table_name)})").fetchall()]


def copy_table(sqlite_connection: sqlite3.Connection, postgres_connection: psycopg.Connection, table_name: str) -> int:
    columns = table_columns(sqlite_connection, table_name)
    if not columns:
        return 0

    quoted_columns = ", ".join(safe_identifier(column) for column in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = (
        f"INSERT INTO {safe_identifier(table_name)} ({quoted_columns}) "
        f"VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    )

    rows = sqlite_connection.execute(f"SELECT {quoted_columns} FROM {safe_identifier(table_name)}").fetchall()
    for row in rows:
        postgres_connection.execute(insert_sql, tuple(row[column] for column in columns))
    return len(rows)


def migrate(sqlite_path: Path, database_url: str) -> None:
    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")
    if not database_url:
        raise RuntimeError("DATABASE_URL or SUPABASE_DATABASE_URL is required.")

    sqlite_connection = sqlite3.connect(sqlite_path)
    sqlite_connection.row_factory = sqlite3.Row
    try:
        table_rows = sqlite_connection.execute(
            """
            SELECT name, sql
            FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
            """
        ).fetchall()
        index_rows = sqlite_connection.execute(
            """
            SELECT name, sql
            FROM sqlite_master
            WHERE type = 'index' AND sql IS NOT NULL
            ORDER BY name
            """
        ).fetchall()

        with psycopg.connect(database_url, prepare_threshold=None) as postgres_connection:
            for row in table_rows:
                postgres_connection.execute(sqlite_create_to_postgres(row["sql"]))
            for row in index_rows:
                postgres_connection.execute(sqlite_create_to_postgres(row["sql"]))

            totals: dict[str, int] = {}
            for row in table_rows:
                table_name = str(row["name"])
                totals[table_name] = copy_table(sqlite_connection, postgres_connection, table_name)

        print("Migration complete.")
        for table_name, count in sorted(totals.items()):
            print(f"{table_name}: {count} rows")
    finally:
        sqlite_connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Mabaso AI SQLite data to Supabase/PostgreSQL.")
    parser.add_argument(
        "--sqlite-path",
        default=os.getenv("SQLITE_DB_PATH") or str(Path(__file__).with_name("mabaso_ai.db")),
        help="Path to the existing SQLite database file.",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or os.getenv("POSTGRES_URL"),
        help="PostgreSQL connection string.",
    )
    args = parser.parse_args()
    migrate(Path(args.sqlite_path).expanduser(), compact_text(args.database_url))


if __name__ == "__main__":
    main()
