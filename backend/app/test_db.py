from database import get_connection

try:
    connection = get_connection()
    print("MySQL connected successfully!")
    connection.close()

except Exception as e:
    print("Connection failed:", e)