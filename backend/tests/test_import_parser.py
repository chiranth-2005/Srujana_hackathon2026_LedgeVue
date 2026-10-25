import io
import sys
import unittest
from pathlib import Path
from datetime import date, datetime
from decimal import Decimal
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import Base, TransactionRecord, User, import_file_rows, parse_uploaded_rows


class ImportParserTests(unittest.TestCase):
    def test_parses_statement_csv_with_preamble_and_debit_credit_columns(self):
        payload = (
            "Account statement;October 2026\n"
            "Transaction Date;Details;Debit;Credit;Category\n"
            "02-Oct-2026;Coffee Shop;₹50.00;0;Dining\n"
            "03-Oct-2026;Salary;0;INR 5000.00;Salary\n"
            ";;;;\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "dataset.csv")

        self.assertEqual(len(transactions), 2)
        self.assertEqual(transactions[0]["date"], date(2026, 10, 2))
        self.assertEqual(transactions[0]["merchant"], "Coffee Shop")
        self.assertEqual(transactions[0]["amount"], 50)
        self.assertEqual(transactions[0]["type"], "expense")
        self.assertEqual(transactions[1]["amount"], 5000)
        self.assertEqual(transactions[1]["type"], "income")

    def test_parses_declared_csv_delimiter(self):
        payload = (
            "sep=;\n"
            "Date;Description;Amount\n"
            "2026-01-01;Corner Store;-12.50\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "declared-separator.csv")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["merchant"], "Corner Store")
        self.assertEqual(transactions[0]["amount"], Decimal("12.50"))

    def test_transaction_parser_yields_before_consuming_all_rows(self):
        from app.main import parse_transaction_rows

        def rows():
            yield ["Date", "Description", "Amount"]
            yield ["2026-01-01", "First Row", "10.00"]
            raise AssertionError("Parser eagerly consumed the remaining file")

        parsed = parse_transaction_rows(rows())

        self.assertEqual(next(parsed)["merchant"], "First Row")

    def test_large_import_helper_writes_rows_in_multiple_batches(self):
        payload = (
            "Date,Description,Amount\n"
            "2026-01-01,First,10.00\n"
            "2026-01-02,Second,-20.00\n"
            "2026-01-03,Third,30.00\n"
        ).encode("utf-8")

        with TemporaryDirectory() as directory:
            engine = create_engine(f"sqlite:///{Path(directory) / 'imports.sqlite'}")
            Base.metadata.create_all(engine)
            sessions = sessionmaker(bind=engine)
            with sessions() as db:
                user = User(name="Import Test", email="import-test@example.com", password_hash="test")
                db.add(user)
                db.commit()
                user_id = user.id

            with (
                patch("app.main.SessionLocal", sessions),
                patch("app.main.IMPORT_BATCH_SIZE", 2),
            ):
                imported = import_file_rows(user_id, io.BytesIO(payload), "large.csv")

            with sessions() as db:
                count = db.scalar(
                    select(func.count()).select_from(TransactionRecord).where(
                        TransactionRecord.user_id == user_id
                    )
                )
            engine.dispose()

        self.assertEqual(imported, 3)
        self.assertEqual(count, 3)

    def test_parses_common_alternate_export_headers_and_iso_timestamps(self):
        payload = (
            "transaction date/time,merchant name,net amount (INR)\n"
            "2026-10-08T14:30:00Z,Pharmacy,-240.00\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "dataset.csv")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["date"], date(2026, 10, 8))
        self.assertEqual(transactions[0]["merchant"], "Pharmacy")
        self.assertEqual(transactions[0]["amount"], 240)
        self.assertEqual(transactions[0]["type"], "expense")

    def test_parses_description_merchant_combined_header(self):
        payload = (
            "Date,Description/Merchant,Amount\n"
            "2026-01-01,Local Diner Breakfast,-22.74\n"
            "2026-01-03,Payroll Direct Deposit,2450.0\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "transaction_history.csv")

        self.assertEqual(len(transactions), 2)
        self.assertEqual(transactions[0]["merchant"], "Local Diner Breakfast")
        self.assertEqual(transactions[0]["type"], "expense")
        self.assertEqual(transactions[0]["amount"], Decimal("22.74"))
        self.assertEqual(transactions[1]["merchant"], "Payroll Direct Deposit")
        self.assertEqual(transactions[1]["type"], "income")
        self.assertEqual(transactions[1]["amount"], Decimal("2450.0"))

    def test_parses_card_transaction_dataset_schema(self):
        payload = (
            "id,date,client_id,card_id,amount,use_chip,merchant_id,merchant_city,merchant_state,zip,mcc,errors\n"
            "7475347,2010-01-01 00:36:00,114,3398,$-64.00,Swipe Transaction,61195,North Hollywood,CA,91606.0,5541,\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "transactions_data.csv")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["merchant"], "Merchant 61195 (North Hollywood, CA 91606)")
        self.assertEqual(transactions[0]["date"], date(2010, 1, 1))
        self.assertEqual(transactions[0]["amount"], Decimal("64.00"))
        self.assertEqual(transactions[0]["type"], "expense")
        self.assertEqual(transactions[0]["account_name"], "Card 3398")

    def test_skips_repeated_headers_blank_rows_and_statement_totals(self):
        payload = (
            "Date,Description,Debit,Credit\n"
            "2026-10-08,Pharmacy,240,0\n"
            "Date,Description,Debit,Credit\n"
            ",,,\n"
            "Total,,240,0\n"
            "End of statement,,,\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "noisy.csv")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["merchant"], "Pharmacy")
        self.assertEqual(transactions[0]["amount"], 240)

    def test_skips_zero_value_rows(self):
        payload = (
            "Date,Description,Amount\n"
            "2026-10-08,Zero-value adjustment,0.00\n"
            "2026-10-09,Pharmacy,-12.50\n"
        ).encode("utf-8")

        transactions = parse_uploaded_rows(payload, "zero-value.csv")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["merchant"], "Pharmacy")

    def test_parses_xlsx_with_title_rows_and_native_dates(self):
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Monthly account activity"])
        sheet.append(["Date", "Transaction Details", "Debit", "Credit"])
        sheet.append([datetime(2026, 10, 4), "Book Store", 125.5, None])
        output = io.BytesIO()
        workbook.save(output)

        transactions = parse_uploaded_rows(output.getvalue(), "statement.xlsx")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["date"], date(2026, 10, 4))
        self.assertEqual(transactions[0]["merchant"], "Book Store")
        self.assertEqual(transactions[0]["amount"], 125.5)
        self.assertEqual(transactions[0]["type"], "expense")

    def test_parses_xls_files_through_the_xlrd_reader(self):
        values = [
            ["Date", "Particulars", "Amount"],
            ["2026-10-05", "Train Ticket", -75],
        ]

        class FakeSheet:
            nrows = len(values)
            ncols = len(values[0])

            def cell(self, row, column):
                return SimpleNamespace(value=values[row][column], ctype=0)

        class FakeWorkbook:
            datemode = 0

            def sheet_by_index(self, _index):
                return FakeSheet()

            def release_resources(self):
                pass

        with patch("app.main.xlrd.open_workbook", return_value=FakeWorkbook()):
            transactions = parse_uploaded_rows(b"legacy xls bytes", "statement.xls")

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0]["merchant"], "Train Ticket")
        self.assertEqual(transactions[0]["amount"], 75)
        self.assertEqual(transactions[0]["type"], "expense")


if __name__ == "__main__":
    unittest.main()