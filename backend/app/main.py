from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import date

from app.database import get_connection

app = FastAPI(title="FinMate AI")

# Transaction input model
class Transaction(BaseModel):
    transaction_type: str
    category: str
    amount: float = Field(gt=0)
    description: str = ""
    transaction_date: date



# 2. Database health check
@app.get("/api/health")
def health():
    try:
        connection = get_connection()
        connection.close()
        return {"status": "Connected to MySQL successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 3. Financial summary
@app.get("/api/summary")
def get_summary():
    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT transaction_type, SUM(amount) AS total
            FROM transactions
            GROUP BY transaction_type
        """)

        results = cursor.fetchall()

        income = 0.0
        expenses = 0.0

        for row in results:
            if row["transaction_type"] == "income":
                income = float(row["total"])
            else:
                expenses = float(row["total"])

        return {
            "income": income,
            "expenses": expenses,
            "balance": income - expenses
        }

    finally:
        connection.close()


# 4. Display transactions
@app.get("/api/transactions")
def get_transactions():
    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT * FROM transactions
            ORDER BY transaction_date DESC, id DESC
        """)

        rows = cursor.fetchall()

        for row in rows:
            row["amount"] = float(row["amount"])
            row["transaction_date"] = str(row["transaction_date"])
            row["created_at"] = str(row["created_at"])

        return rows

    finally:
        connection.close()


# 5. Add transaction
@app.post("/api/transactions")
def add_transaction(transaction: Transaction):

    if transaction.transaction_type not in ["income", "expense"]:
        raise HTTPException(
            status_code=400,
            detail="Transaction type must be income or expense"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO transactions
            (transaction_type, category, amount, description, transaction_date)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            transaction.transaction_type,
            transaction.category,
            transaction.amount,
            transaction.description,
            transaction.transaction_date
        ))

        connection.commit()

        return {
            "message": "Transaction added successfully!",
            "id": cursor.lastrowid
        }

    finally:
        connection.close()

        
# FINMATE AI - First Finance Tool

class ChatRequest(BaseModel):
    message: str


@app.post("/api/agent/chat")
def finance_agent(request: ChatRequest):

    message = request.message.lower()

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        # Get total income and expenses
        cursor.execute("""
            SELECT
                transaction_type,
                SUM(amount) AS total
            FROM transactions
            GROUP BY transaction_type
        """)

        results = cursor.fetchall()

        income = 0
        expenses = 0

        for row in results:
            if row["transaction_type"] == "income":
                income = float(row["total"])
            elif row["transaction_type"] == "expense":
                expenses = float(row["total"])

        balance = income - expenses

        # Financial summary
        if any(word in message for word in ["summary", "balance", "income", "financial"]):

            reply = (
                f"Here is your financial summary:\n\n"
                f"Total Income: ₹{income:,.2f}\n"
                f"Total Expenses: ₹{expenses:,.2f}\n"
                f"Current Balance: ₹{balance:,.2f}"
            )

        # Expense analysis
        elif any(word in message for word in ["expense", "spend", "spent", "money go"]):

            cursor.execute("""
                SELECT category, SUM(amount) AS total
                FROM transactions
                WHERE transaction_type = 'expense'
                GROUP BY category
                ORDER BY total DESC
            """)

            categories = cursor.fetchall()

            if categories:
                details = "\n".join(
                    f"{row['category']}: ₹{float(row['total']):,.2f}"
                    for row in categories
                )

                reply = "Here is your expense analysis:\n\n" + details
            else:
                reply = "You haven't recorded any expenses yet."

        # Savings suggestions
        elif any(word in message for word in ["save", "saving", "savings"]):

            if expenses == 0:
                reply = "Start recording your expenses, and I can help you find saving opportunities."

            elif balance <= 0:
                reply = "Your expenses are currently equal to or greater than your income. Try reviewing non-essential spending."

            else:
                suggestion = expenses * 0.10

                reply = (
                    f"Here is a savings suggestion:\n\n"
                    f"Your current balance is ₹{balance:,.2f}.\n"
                    f"Consider reducing your expenses by 10% "
                    f"(approximately ₹{suggestion:,.2f}) to increase your savings."
                )

        # Default response
        else:
            reply = (
                "I'm your FinMate Finance Agent! "
                "You can ask me about your financial summary, "
                "expenses or savings suggestions."
            )

        return {"reply": reply}

    finally:
        connection.close()

# Serve FinMate AI frontend
BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"

app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR), html=True),
    name="frontend"
)