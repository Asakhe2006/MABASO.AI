import re
import unittest
from pathlib import Path


class PostgresRlsMigrationTests(unittest.TestCase):
    def test_rls_migration_escapes_psycopg_percent_markers(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")
        migration_start = source.index("DO $$")
        migration_end = source.index("END $$;", migration_start)
        migration = source[migration_start:migration_end]

        # Psycopg parses % markers before PostgreSQL sees the DO block. PostgreSQL's
        # format() identifiers must therefore be written as %%I / %%s here.
        self.assertNotRegex(migration, re.compile(r"(?<!%)%(?:I|s)"))
        self.assertIn("format('%%I.%%I'", migration)
        self.assertIn("TO %%s USING (false)", migration)


if __name__ == "__main__":
    unittest.main()
