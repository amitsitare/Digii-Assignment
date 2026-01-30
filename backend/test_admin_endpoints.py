"""
Test script for admin endpoints
Tests: Admin registration, login, add professors/students (single & CSV upload)
"""
import requests
import json
import csv
import io
import os
import sys

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:5000/api"

# Test data
ADMIN_DATA = {
    "email": "admin@test.com",
    "password": "Admin123!",
    "first_name": "Test",
    "last_name": "Admin"
}

def print_response(title, response):
    """Print formatted response"""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")
    print(f"{'='*60}\n")

def test_admin_register():
    """Test admin registration"""
    print("\n[TEST 1] Admin Registration")
    url = f"{BASE_URL}/auth/register"
    response = requests.post(url, json=ADMIN_DATA)
    print_response("Admin Registration", response)
    return response.status_code in [201, 400]  # 400 if already exists

def test_admin_login():
    """Test admin login"""
    print("\n[TEST 2] Admin Login")
    url = f"{BASE_URL}/auth/login"
    response = requests.post(url, json={
        "email": ADMIN_DATA["email"],
        "password": ADMIN_DATA["password"]
    })
    print_response("Admin Login", response)
    
    if response.status_code == 200:
        data = response.json()
        return data.get('access_token')
    return None

def test_add_single_professor(token):
    """Test adding a single professor"""
    print("\n[TEST 3] Add Single Professor")
    url = f"{BASE_URL}/admin/professors"
    headers = {"Authorization": f"Bearer {token}"}
    
    # First, get departments to get a valid department_id
    dept_url = f"{BASE_URL}/admin/departments"
    dept_response = requests.get(dept_url, headers=headers)
    
    if dept_response.status_code != 200:
        print("[ERROR] Failed to get departments")
        return False
    
    departments = dept_response.json().get('departments', [])
    if not departments:
        print("[ERROR] No departments found. Please ensure schema.sql has been run.")
        return False
    
    department_id = departments[0]['id']
    
    professor_data = {
        "email": "prof1@test.com",
        "first_name": "John",
        "last_name": "Professor",
        "department_id": department_id
    }
    
    response = requests.post(url, json=professor_data, headers=headers)
    print_response("Add Single Professor", response)
    return response.status_code in [201, 400]  # 400 if already exists

def test_add_single_student(token):
    """Test adding a single student"""
    print("\n[TEST 4] Add Single Student")
    url = f"{BASE_URL}/admin/students"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get departments
    dept_url = f"{BASE_URL}/admin/departments"
    dept_response = requests.get(dept_url, headers=headers)
    
    if dept_response.status_code != 200:
        print("[ERROR] Failed to get departments")
        return False
    
    departments = dept_response.json().get('departments', [])
    if not departments:
        print("[ERROR] No departments found")
        return False
    
    department_id = departments[0]['id']
    
    student_data = {
        "email": "student1@test.com",
        "first_name": "Alice",
        "last_name": "Student",
        "department_id": department_id,
        "batch": "2027"
    }
    
    response = requests.post(url, json=student_data, headers=headers)
    print_response("Add Single Student", response)
    return response.status_code in [201, 400]  # 400 if already exists

def create_professors_csv():
    """Create a CSV file for professors"""
    csv_data = [
        ["email", "first_name", "last_name", "department_code"],
        ["prof2@test.com", "Jane", "Smith", "CSE"],
        ["prof3@test.com", "Bob", "Johnson", "ECE"],
        ["prof4@test.com", "Mary", "Williams", "ME"]
    ]
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(csv_data)
    csv_content = output.getvalue()
    output.close()
    
    return csv_content.encode('utf-8')

def create_students_csv():
    """Create a CSV file for students"""
    csv_data = [
        ["email", "first_name", "last_name", "department_code", "batch"],
        ["student2@test.com", "Charlie", "Brown", "CSE", "2027"],
        ["student3@test.com", "Diana", "Prince", "ECE", "2026"],
        ["student4@test.com", "Edward", "Norton", "ME", "2027"]
    ]
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(csv_data)
    csv_content = output.getvalue()
    output.close()
    
    return csv_content.encode('utf-8')

def test_upload_professors_csv(token):
    """Test uploading professors CSV"""
    print("\n[TEST 5] Upload Professors CSV")
    url = f"{BASE_URL}/admin/professors/upload-csv"
    headers = {"Authorization": f"Bearer {token}"}
    
    csv_content = create_professors_csv()
    
    files = {
        'file': ('professors.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, files=files, headers=headers)
    print_response("Upload Professors CSV", response)
    return response.status_code == 200

def test_upload_students_csv(token):
    """Test uploading students CSV"""
    print("\n[TEST 6] Upload Students CSV")
    url = f"{BASE_URL}/admin/students/upload-csv"
    headers = {"Authorization": f"Bearer {token}"}
    
    csv_content = create_students_csv()
    
    files = {
        'file': ('students.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, files=files, headers=headers)
    print_response("Upload Students CSV", response)
    return response.status_code == 200

def test_list_users(token):
    """Test listing users"""
    print("\n[TEST 7] List Users")
    url = f"{BASE_URL}/admin/users"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    print_response("List Users", response)
    return response.status_code == 200

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("ADMIN ENDPOINTS TEST SUITE")
    print("="*60)
    
    # Check if server is running
    try:
        health_check = requests.get(f"{BASE_URL}/health", timeout=5)
        if health_check.status_code != 200:
            print("[ERROR] Server is not responding correctly. Please ensure the backend is running.")
            return
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to server. Please ensure the backend is running on http://localhost:5000")
        print("   Run: cd backend && python run.py")
        return
    
    print("[OK] Server is running")
    
    results = {}
    
    # Test 1: Admin Registration
    results['register'] = test_admin_register()
    
    # Test 2: Admin Login
    token = test_admin_login()
    if not token:
        print("[ERROR] Login failed. Cannot proceed with remaining tests.")
        return
    results['login'] = True
    
    # Test 3: Add Single Professor
    results['add_professor'] = test_add_single_professor(token)
    
    # Test 4: Add Single Student
    results['add_student'] = test_add_single_student(token)
    
    # Test 5: Upload Professors CSV
    results['upload_professors_csv'] = test_upload_professors_csv(token)
    
    # Test 6: Upload Students CSV
    results['upload_students_csv'] = test_upload_students_csv(token)
    
    # Test 7: List Users
    results['list_users'] = test_list_users(token)
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    for test_name, passed in results.items():
        status = "[PASSED]" if passed else "[FAILED]"
        print(f"{test_name:30} {status}")
    print("="*60)

if __name__ == "__main__":
    main()
