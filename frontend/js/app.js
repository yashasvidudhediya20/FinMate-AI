
const API_URL = "/api";

// ==========================================
// COMMON FUNCTION
// ==========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

// ==========================================
// DASHBOARD FUNCTIONS
// ==========================================

// Load financial summary
async function loadSummary() {
    try {
        const response = await fetch(`${API_URL}/summary`);

        if (!response.ok) {
            throw new Error("Could not load summary");
        }

        const data = await response.json();

        document.getElementById("balance").textContent =
            formatCurrency(data.balance);

        document.getElementById("income").textContent =
            formatCurrency(data.income);

        document.getElementById("expenses").textContent =
            formatCurrency(data.expenses);

    } catch (error) {
        console.error("Summary error:", error);
    }
}

// Load transactions
async function loadTransactions() {
    const transactionList = document.getElementById("transaction-list");

    try {
        const response = await fetch(`${API_URL}/transactions`);

        if (!response.ok) {
            throw new Error("Could not load transactions");
        }

        const transactions = await response.json();

        transactionList.replaceChildren();

        if (transactions.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 5;
            cell.className = "empty-state";
            cell.textContent =
                "No transactions yet. Add your first transaction below!";

            row.appendChild(cell);
            transactionList.appendChild(row);
            return;
        }

        transactions.forEach(transaction => {
            const row = document.createElement("tr");

            const categoryCell = document.createElement("td");
            categoryCell.textContent = transaction.category;

            const descriptionCell = document.createElement("td");
            descriptionCell.textContent = transaction.description || "-";

            const dateCell = document.createElement("td");
            dateCell.textContent = transaction.transaction_date;

            const typeCell = document.createElement("td");
            typeCell.textContent = transaction.transaction_type;
            typeCell.className =
                transaction.transaction_type === "income"
                    ? "positive"
                    : "negative";

            const amountCell = document.createElement("td");
            const sign =
                transaction.transaction_type === "income" ? "+" : "-";

            amountCell.textContent =
                sign + formatCurrency(transaction.amount);

            row.append(
                categoryCell,
                descriptionCell,
                dateCell,
                typeCell,
                amountCell
            );

            transactionList.appendChild(row);
        });

    } catch (error) {
        console.error("Transaction error:", error);
        transactionList.textContent = "Unable to load transactions.";
    }
}

// Add transaction
async function addTransaction(event) {
    event.preventDefault();

    const submitButton = document.getElementById("submit-btn");
    const message = document.getElementById("form-message");

    const transaction = {
        transaction_type:
            document.getElementById("transaction-type").value,

        category:
            document.getElementById("category").value.trim(),

        amount:
            Number(document.getElementById("amount").value),

        description:
            document.getElementById("description").value.trim(),

        transaction_date:
            document.getElementById("transaction-date").value
    };

    if (
        !transaction.category ||
        !transaction.transaction_date ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0
    ) {
        message.textContent =
            "Please enter valid transaction details.";

        message.style.color = "#e36d78";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Adding...";

    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Failed to add transaction"
            );
        }

        message.textContent = "Transaction added successfully!";
        message.style.color = "#20a779";

        document.getElementById("transaction-form").reset();

        setTodayDate();

        await loadSummary();
        await loadTransactions();

    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#e36d78";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "+ Add Transaction";
    }
}

// Set today's date
function setTodayDate() {
    const dateInput = document.getElementById("transaction-date");

    if (!dateInput) return;

    const today = new Date();

    const localDate = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];

    dateInput.value = localDate;
}

// ==========================================
// FINMATE AI - CHAT AGENT
// ==========================================

async function sendAgentMessage(message) {

    if (!message.trim()) return;

    const chatMessages =
        document.getElementById("chat-messages");

    const chatInput =
        document.getElementById("chat-input");

    if (!chatMessages || !chatInput) return;

    // Display user message
    const userMessage = document.createElement("div");

    userMessage.className = "user-message";
    userMessage.textContent = message;

    chatMessages.appendChild(userMessage);

    chatInput.value = "";

    try {
        const response = await fetch(`${API_URL}/agent/chat`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Something went wrong."
            );
        }

        // Display agent response
        const botMessage = document.createElement("div");

        botMessage.className = "bot-message";

        const avatar = document.createElement("div");

        avatar.className = "bot-avatar";
        avatar.textContent = "✦";

        const messageBox = document.createElement("div");

        messageBox.className = "message";
        messageBox.textContent = data.reply;

        botMessage.appendChild(avatar);
        botMessage.appendChild(messageBox);

        chatMessages.appendChild(botMessage);

    } catch (error) {

        const errorMessage = document.createElement("div");

        errorMessage.className = "message";
        errorMessage.textContent =
            "Sorry! " + error.message;

        chatMessages.appendChild(errorMessage);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    // Dashboard initialization
    const transactionForm =
        document.getElementById("transaction-form");

    if (transactionForm) {

        setTodayDate();

        transactionForm.addEventListener(
            "submit",
            addTransaction
        );

        loadSummary();
        loadTransactions();
    }

    // Agent chat initialization
    const chatForm =
        document.getElementById("chat-form");

    const chatInput =
        document.getElementById("chat-input");

    if (chatForm && chatInput) {

        chatForm.addEventListener("submit", event => {

            event.preventDefault();

            sendAgentMessage(chatInput.value);
        });
    }

    // Finance tools and quick actions
    document.querySelectorAll("[data-prompt]").forEach(button => {

        button.addEventListener("click", () => {

            sendAgentMessage(button.dataset.prompt);
        });
    });

});
