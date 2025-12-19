"""
Comprehensive Test Data Seeder for Sharda HR
Seeds data for ALL modules to enable complete testing
"""
import asyncio
import os
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to MongoDB
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Sample data
FIRST_NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anita", "Rajesh", "Kavita", "Suresh", "Meera",
               "Arun", "Deepa", "Nikhil", "Pooja", "Sanjay", "Rekha", "Manoj", "Sunita", "Ashok", "Neha",
               "Vivek", "Ritu", "Kiran", "Anjali", "Rohit", "Swati", "Gaurav", "Shikha", "Pankaj", "Divya"]

LAST_NAMES = ["Sharma", "Verma", "Patel", "Singh", "Kumar", "Gupta", "Joshi", "Mehta", "Shah", "Reddy",
              "Nair", "Iyer", "Rao", "Desai", "Pillai", "Menon", "Bhat", "Hegde", "Kulkarni", "Patil"]

DEPARTMENTS = [
    {"dept_id": "dept_hr", "name": "Human Resources", "code": "HR"},
    {"dept_id": "dept_eng", "name": "Engineering", "code": "ENG"},
    {"dept_id": "dept_sales", "name": "Sales", "code": "SALES"},
    {"dept_id": "dept_fin", "name": "Finance", "code": "FIN"},
    {"dept_id": "dept_mkt", "name": "Marketing", "code": "MKT"},
    {"dept_id": "dept_ops", "name": "Operations", "code": "OPS"},
    {"dept_id": "dept_it", "name": "IT Infrastructure", "code": "IT"},
    {"dept_id": "dept_admin", "name": "Administration", "code": "ADMIN"},
]

DESIGNATIONS = [
    {"desig_id": "desig_ceo", "name": "CEO", "grade": "E1"},
    {"desig_id": "desig_vp", "name": "Vice President", "grade": "E2"},
    {"desig_id": "desig_dir", "name": "Director", "grade": "M1"},
    {"desig_id": "desig_mgr", "name": "Manager", "grade": "M2"},
    {"desig_id": "desig_lead", "name": "Team Lead", "grade": "M3"},
    {"desig_id": "desig_sr", "name": "Senior Executive", "grade": "S1"},
    {"desig_id": "desig_exec", "name": "Executive", "grade": "S2"},
    {"desig_id": "desig_jr", "name": "Junior Executive", "grade": "S3"},
    {"desig_id": "desig_trainee", "name": "Trainee", "grade": "T1"},
]

LEAVE_TYPES = [
    {"leave_type_id": "lt_cl", "name": "Casual Leave", "code": "CL", "annual_quota": 12, "carry_forward_allowed": False},
    {"leave_type_id": "lt_sl", "name": "Sick Leave", "code": "SL", "annual_quota": 12, "carry_forward_allowed": False},
    {"leave_type_id": "lt_el", "name": "Earned Leave", "code": "EL", "annual_quota": 15, "carry_forward_allowed": True, "max_carry_forward": 30},
    {"leave_type_id": "lt_pl", "name": "Privilege Leave", "code": "PL", "annual_quota": 10, "carry_forward_allowed": True},
    {"leave_type_id": "lt_ml", "name": "Maternity Leave", "code": "ML", "annual_quota": 180, "carry_forward_allowed": False},
    {"leave_type_id": "lt_ptl", "name": "Paternity Leave", "code": "PTL", "annual_quota": 15, "carry_forward_allowed": False},
    {"leave_type_id": "lt_co", "name": "Compensatory Off", "code": "CO", "annual_quota": 0, "carry_forward_allowed": False},
    {"leave_type_id": "lt_lwp", "name": "Leave Without Pay", "code": "LWP", "annual_quota": 0, "carry_forward_allowed": False},
]

EXPENSE_CATEGORIES = [
    {"code": "travel", "name": "Travel", "limit": 50000},
    {"code": "food", "name": "Food & Meals", "limit": 10000},
    {"code": "accommodation", "name": "Accommodation", "limit": 25000},
    {"code": "client_entertainment", "name": "Client Entertainment", "limit": 20000},
    {"code": "fuel", "name": "Fuel", "limit": 15000},
    {"code": "office_supplies", "name": "Office Supplies", "limit": 5000},
    {"code": "communication", "name": "Communication", "limit": 5000},
    {"code": "other", "name": "Other", "limit": 10000},
]

ASSET_TYPES = ["Laptop", "Desktop", "Monitor", "Mobile", "Headset", "Keyboard", "Mouse", "Chair", "Desk", "ID Card"]

async def clear_collections():
    """Clear existing test data"""
    collections = [
        'employees', 'users', 'attendance', 'leave_requests', 'leave_balances',
        'expenses', 'assets', 'asset_requests', 'grievance_tickets', 'job_postings',
        'job_applications', 'onboarding_tasks', 'exit_requests', 'kpi_records',
        'goals', 'documents', 'announcements', 'contractors', 'workers',
        'payroll_runs', 'payslips', 'employee_salaries', 'kpi_templates'
    ]
    for col in collections:
        await db[col].delete_many({})
    print("✅ Cleared existing data")

async def seed_master_data():
    """Seed master data"""
    # Departments
    await db.departments.delete_many({})
    for dept in DEPARTMENTS:
        dept['is_active'] = True
        dept['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.departments.insert_many(DEPARTMENTS)
    
    # Designations
    await db.designations.delete_many({})
    for desig in DESIGNATIONS:
        desig['is_active'] = True
        desig['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.designations.insert_many(DESIGNATIONS)
    
    # Leave Types
    await db.leave_types.delete_many({})
    for lt in LEAVE_TYPES:
        lt['is_active'] = True
        lt['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.leave_types.insert_many(LEAVE_TYPES)
    
    # Expense Categories
    await db.expense_categories.delete_many({})
    await db.expense_categories.insert_many(EXPENSE_CATEGORIES)
    
    print("✅ Seeded master data")

async def seed_employees_and_users():
    """Seed employees and users"""
    employees = []
    users = []
    
    # Admin user
    admin_user = {
        "user_id": "user_admin",
        "email": "admin@shardahr.com",
        "password": pwd_context.hash("Admin@123"),
        "password_hash": pwd_context.hash("Admin@123"),
        "name": "System Administrator",
        "role": "super_admin",
        "employee_id": "EMP001",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(admin_user)
    
    admin_emp = {
        "employee_id": "EMP001",
        "employee_code": "SHRD001",
        "user_id": "user_admin",
        "first_name": "System",
        "last_name": "Administrator",
        "email": "admin@shardahr.com",
        "phone": "+91 9876543210",
        "department": "Human Resources",
        "department_id": "dept_hr",
        "designation": "CEO",
        "designation_id": "desig_ceo",
        "date_of_joining": "2020-01-01",
        "date_of_birth": "1980-05-15",
        "gender": "Male",
        "blood_group": "O+",
        "address": "123 Admin Street, Mumbai",
        "emergency_contact": "+91 9876543211",
        "bank_account": "1234567890",
        "pan_number": "ABCDE1234F",
        "aadhar_number": "1234-5678-9012",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(admin_emp)
    
    # HR Admin
    hr_user = {
        "user_id": "user_hr",
        "email": "hr@shardahr.com",
        "password": pwd_context.hash("Hr@12345"),
        "password_hash": pwd_context.hash("Hr@12345"),
        "name": "HR Manager",
        "role": "hr_admin",
        "employee_id": "EMP002",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(hr_user)
    
    hr_emp = {
        "employee_id": "EMP002",
        "employee_code": "SHRD002",
        "user_id": "user_hr",
        "first_name": "Priya",
        "last_name": "Sharma",
        "email": "hr@shardahr.com",
        "phone": "+91 9876543220",
        "department": "Human Resources",
        "department_id": "dept_hr",
        "designation": "Manager",
        "designation_id": "desig_mgr",
        "date_of_joining": "2021-03-15",
        "date_of_birth": "1985-08-20",
        "gender": "Female",
        "blood_group": "A+",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(hr_emp)
    
    # Finance User
    fin_user = {
        "user_id": "user_fin",
        "email": "finance@shardahr.com",
        "password": pwd_context.hash("Finance@123"),
        "password_hash": pwd_context.hash("Finance@123"),
        "name": "Finance Head",
        "role": "finance",
        "employee_id": "EMP003",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(fin_user)
    
    fin_emp = {
        "employee_id": "EMP003",
        "employee_code": "SHRD003",
        "user_id": "user_fin",
        "first_name": "Rajesh",
        "last_name": "Gupta",
        "email": "finance@shardahr.com",
        "phone": "+91 9876543230",
        "department": "Finance",
        "department_id": "dept_fin",
        "designation": "Manager",
        "designation_id": "desig_mgr",
        "date_of_joining": "2021-06-01",
        "date_of_birth": "1982-12-10",
        "gender": "Male",
        "blood_group": "B+",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(fin_emp)
    
    # Manager User
    mgr_user = {
        "user_id": "user_mgr",
        "email": "manager@shardahr.com",
        "password": pwd_context.hash("Manager@123"),
        "password_hash": pwd_context.hash("Manager@123"),
        "name": "Amit Kumar",
        "role": "manager",
        "employee_id": "EMP004",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(mgr_user)
    
    mgr_emp = {
        "employee_id": "EMP004",
        "employee_code": "SHRD004",
        "user_id": "user_mgr",
        "first_name": "Amit",
        "last_name": "Kumar",
        "email": "manager@shardahr.com",
        "phone": "+91 9876543240",
        "department": "Engineering",
        "department_id": "dept_eng",
        "designation": "Manager",
        "designation_id": "desig_mgr",
        "date_of_joining": "2022-01-10",
        "date_of_birth": "1988-03-25",
        "gender": "Male",
        "blood_group": "AB+",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(mgr_emp)
    
    # Regular Employee
    emp_user = {
        "user_id": "user_emp",
        "email": "employee@shardahr.com",
        "password": pwd_context.hash("Employee@123"),
        "password_hash": pwd_context.hash("Employee@123"),
        "name": "Sneha Patel",
        "role": "employee",
        "employee_id": "EMP005",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(emp_user)
    
    emp_emp = {
        "employee_id": "EMP005",
        "employee_code": "SHRD005",
        "user_id": "user_emp",
        "first_name": "Sneha",
        "last_name": "Patel",
        "email": "employee@shardahr.com",
        "phone": "+91 9876543250",
        "department": "Engineering",
        "department_id": "dept_eng",
        "designation": "Senior Executive",
        "designation_id": "desig_sr",
        "date_of_joining": "2023-02-01",
        "date_of_birth": "1995-07-15",
        "gender": "Female",
        "blood_group": "O-",
        "reporting_manager_id": "EMP004",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(emp_emp)
    
    # Generate 45 more employees
    roles = ["employee", "employee", "employee", "employee", "manager"]
    for i in range(6, 51):
        emp_id = f"EMP{str(i).zfill(3)}"
        user_id = f"user_{i}"
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        email = f"{first_name.lower()}.{last_name.lower()}{i}@shardahr.com"
        dept = random.choice(DEPARTMENTS)
        desig = random.choice(DESIGNATIONS[3:])  # Manager and below
        
        user = {
            "user_id": user_id,
            "email": email,
            "password": pwd_context.hash("Test@1234"),
            "password_hash": pwd_context.hash("Test@1234"),
            "name": f"{first_name} {last_name}",
            "role": random.choice(roles),
            "employee_id": emp_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        users.append(user)
        
        emp = {
            "employee_id": emp_id,
            "employee_code": f"SHRD{str(i).zfill(3)}",
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": f"+91 98765{str(43200 + i)}",
            "department": dept["name"],
            "department_id": dept["dept_id"],
            "designation": desig["name"],
            "designation_id": desig["desig_id"],
            "date_of_joining": (datetime.now() - timedelta(days=random.randint(30, 1000))).strftime("%Y-%m-%d"),
            "date_of_birth": (datetime.now() - timedelta(days=random.randint(8000, 15000))).strftime("%Y-%m-%d"),
            "gender": random.choice(["Male", "Female"]),
            "blood_group": random.choice(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
            "reporting_manager_id": random.choice(["EMP002", "EMP003", "EMP004"]),
            "status": "active",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employees.append(emp)
    
    await db.users.insert_many(users)
    await db.employees.insert_many(employees)
    print(f"✅ Seeded {len(employees)} employees and {len(users)} users")
    return employees

async def seed_attendance(employees):
    """Seed attendance records for last 60 days"""
    attendance_records = []
    today = datetime.now()
    
    statuses = ["present", "present", "present", "present", "present", "wfh", "half_day", "absent", "late"]
    
    for emp in employees[:30]:  # First 30 employees get attendance
        for day_offset in range(60):
            date = today - timedelta(days=day_offset)
            if date.weekday() >= 5:  # Skip weekends
                continue
            
            status = random.choice(statuses)
            punch_in = f"{random.randint(8, 10)}:{random.randint(0, 59):02d}"
            punch_out = f"{random.randint(17, 20)}:{random.randint(0, 59):02d}"
            
            record = {
                "attendance_id": f"att_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "date": date.strftime("%Y-%m-%d"),
                "status": status,
                "first_in": punch_in if status != "absent" else None,
                "last_out": punch_out if status not in ["absent", "half_day"] else (f"{random.randint(12, 14)}:{random.randint(0, 59):02d}" if status == "half_day" else None),
                "total_hours": random.uniform(6, 10) if status != "absent" else 0,
                "punches": [
                    {"type": "IN", "time": punch_in, "source": random.choice(["biometric", "manual", "wfh"])},
                    {"type": "OUT", "time": punch_out, "source": random.choice(["biometric", "manual", "wfh"])}
                ] if status != "absent" else [],
                "location": f"{random.uniform(18.5, 19.5):.6f}, {random.uniform(72.8, 73.0):.6f}" if random.random() > 0.5 else None,
                "remarks": "WFH approved" if status == "wfh" else ("Late arrival" if status == "late" else None),
                "created_at": date.isoformat()
            }
            attendance_records.append(record)
    
    await db.attendance.insert_many(attendance_records)
    print(f"✅ Seeded {len(attendance_records)} attendance records")

async def seed_leave_requests(employees):
    """Seed leave requests with various statuses"""
    leave_requests = []
    leave_balances = []
    
    statuses = ["pending", "approved", "rejected", "cancelled"]
    
    for emp in employees[:25]:
        # Create leave balance
        for lt in LEAVE_TYPES[:6]:
            balance = {
                "balance_id": f"bal_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "leave_type_id": lt["leave_type_id"],
                "year": 2025,
                "allocated": lt["annual_quota"],
                "used": random.randint(0, min(5, lt["annual_quota"])),
                "pending": random.randint(0, 2),
                "balance": lt["annual_quota"] - random.randint(0, 5),
                "carry_forward": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            leave_balances.append(balance)
        
        # Create 2-5 leave requests per employee
        for _ in range(random.randint(2, 5)):
            start_date = datetime.now() + timedelta(days=random.randint(-30, 30))
            days = random.randint(1, 5)
            end_date = start_date + timedelta(days=days - 1)
            lt = random.choice(LEAVE_TYPES[:6])
            status = random.choice(statuses)
            
            request = {
                "request_id": f"lr_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "leave_type_id": lt["leave_type_id"],
                "leave_type_name": lt["name"],
                "from_date": start_date.strftime("%Y-%m-%d"),
                "to_date": end_date.strftime("%Y-%m-%d"),
                "days": days,
                "reason": random.choice([
                    "Family function", "Personal work", "Medical appointment", 
                    "Vacation", "Emergency", "Festival celebration", "Wedding"
                ]),
                "status": status,
                "applied_on": (start_date - timedelta(days=random.randint(1, 10))).isoformat(),
                "approved_by": "EMP002" if status == "approved" else None,
                "approved_on": (start_date - timedelta(days=random.randint(1, 5))).isoformat() if status == "approved" else None,
                "rejection_reason": "Insufficient leave balance" if status == "rejected" else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            leave_requests.append(request)
    
    await db.leave_requests.insert_many(leave_requests)
    await db.leave_balances.insert_many(leave_balances)
    print(f"✅ Seeded {len(leave_requests)} leave requests and {len(leave_balances)} leave balances")

async def seed_expenses(employees):
    """Seed expense claims"""
    expenses = []
    statuses = ["pending", "approved", "rejected", "reimbursed"]
    
    for emp in employees[:20]:
        for _ in range(random.randint(2, 6)):
            category = random.choice(EXPENSE_CATEGORIES)
            amount = random.randint(500, 15000)
            status = random.choice(statuses)
            
            expense = {
                "claim_id": f"exp_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "title": random.choice([
                    "Client visit travel", "Team lunch", "Office supplies purchase",
                    "Cab fare for meeting", "Internet reimbursement", "Mobile bill",
                    "Conference registration", "Training materials"
                ]),
                "category": category["code"],
                "amount": amount,
                "approved_amount": amount if status in ["approved", "reimbursed"] else None,
                "expense_date": (datetime.now() - timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d"),
                "description": f"Expense for {category['name'].lower()} related work",
                "receipt_url": None,
                "status": status,
                "approved_by": "EMP003" if status in ["approved", "reimbursed"] else None,
                "rejection_reason": "Missing receipt" if status == "rejected" else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            expenses.append(expense)
    
    await db.expenses.insert_many(expenses)
    print(f"✅ Seeded {len(expenses)} expense claims")

async def seed_assets(employees):
    """Seed assets and asset requests"""
    assets = []
    asset_requests = []
    
    # Create assets
    for i in range(100):
        asset_type = random.choice(ASSET_TYPES)
        assigned_to = random.choice(employees[:30])["employee_id"] if random.random() > 0.3 else None
        
        asset = {
            "asset_id": f"ast_{uuid.uuid4().hex[:12]}",
            "asset_code": f"SHRD-{asset_type[:3].upper()}-{str(i+1).zfill(4)}",
            "name": f"{random.choice(['Dell', 'HP', 'Lenovo', 'Apple', 'Logitech'])} {asset_type}",
            "type": asset_type,
            "category": "IT Equipment" if asset_type in ["Laptop", "Desktop", "Monitor", "Keyboard", "Mouse"] else "Office Equipment",
            "serial_number": f"SN{uuid.uuid4().hex[:10].upper()}",
            "purchase_date": (datetime.now() - timedelta(days=random.randint(30, 500))).strftime("%Y-%m-%d"),
            "purchase_price": random.randint(5000, 100000),
            "warranty_expiry": (datetime.now() + timedelta(days=random.randint(100, 700))).strftime("%Y-%m-%d"),
            "status": "assigned" if assigned_to else random.choice(["available", "maintenance", "retired"]),
            "assigned_to": assigned_to,
            "assigned_date": (datetime.now() - timedelta(days=random.randint(1, 100))).strftime("%Y-%m-%d") if assigned_to else None,
            "location": random.choice(["Mumbai HQ", "Pune Office", "Delhi Branch", "Bangalore Office"]),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        assets.append(asset)
    
    # Asset requests
    for emp in employees[10:25]:
        request = {
            "request_id": f"ar_{uuid.uuid4().hex[:12]}",
            "employee_id": emp["employee_id"],
            "asset_type": random.choice(ASSET_TYPES),
            "justification": random.choice([
                "Current laptop is slow", "Need for project work",
                "Replacement required", "New joining requirement"
            ]),
            "urgency": random.choice(["low", "medium", "high"]),
            "status": random.choice(["pending", "approved", "rejected", "fulfilled"]),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        asset_requests.append(request)
    
    await db.assets.insert_many(assets)
    await db.asset_requests.insert_many(asset_requests)
    print(f"✅ Seeded {len(assets)} assets and {len(asset_requests)} asset requests")

async def seed_grievances(employees):
    """Seed grievance/helpdesk tickets"""
    tickets = []
    categories = ["IT Support", "HR Query", "Payroll Issue", "Facilities", "Policy Clarification", "Other"]
    priorities = ["low", "medium", "high", "critical"]
    statuses = ["open", "in_progress", "resolved", "closed"]
    
    for emp in employees[:20]:
        for _ in range(random.randint(1, 3)):
            ticket = {
                "ticket_id": f"tkt_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "category": random.choice(categories),
                "subject": random.choice([
                    "Salary discrepancy", "Leave balance incorrect", "System access issue",
                    "AC not working", "Parking allocation", "ID card replacement",
                    "Insurance claim query", "Training request", "Laptop repair needed"
                ]),
                "description": "Detailed description of the issue that needs to be addressed.",
                "priority": random.choice(priorities),
                "status": random.choice(statuses),
                "assigned_to": random.choice(["EMP002", "EMP003"]) if random.random() > 0.3 else None,
                "resolution": "Issue has been resolved" if random.random() > 0.5 else None,
                "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            tickets.append(ticket)
    
    await db.grievance_tickets.insert_many(tickets)
    print(f"✅ Seeded {len(tickets)} grievance tickets")

async def seed_recruitment():
    """Seed job postings and applications"""
    job_postings = []
    applications = []
    
    jobs = [
        {"title": "Senior Software Engineer", "dept": "Engineering", "location": "Mumbai"},
        {"title": "HR Executive", "dept": "Human Resources", "location": "Mumbai"},
        {"title": "Sales Manager", "dept": "Sales", "location": "Delhi"},
        {"title": "Financial Analyst", "dept": "Finance", "location": "Bangalore"},
        {"title": "Marketing Executive", "dept": "Marketing", "location": "Mumbai"},
        {"title": "DevOps Engineer", "dept": "IT Infrastructure", "location": "Pune"},
        {"title": "Product Manager", "dept": "Engineering", "location": "Mumbai"},
        {"title": "Business Analyst", "dept": "Operations", "location": "Bangalore"},
    ]
    
    for job in jobs:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        posting = {
            "job_id": job_id,
            "title": job["title"],
            "department": job["dept"],
            "location": job["location"],
            "employment_type": random.choice(["full_time", "contract"]),
            "experience_min": random.randint(2, 5),
            "experience_max": random.randint(6, 12),
            "salary_min": random.randint(500000, 1000000),
            "salary_max": random.randint(1200000, 2500000),
            "description": f"We are looking for a {job['title']} to join our team.",
            "requirements": ["Bachelor's degree", "Relevant experience", "Good communication"],
            "status": random.choice(["open", "open", "open", "closed", "on_hold"]),
            "posted_by": "EMP002",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        job_postings.append(posting)
        
        # Applications for each job
        for i in range(random.randint(5, 15)):
            app = {
                "application_id": f"app_{uuid.uuid4().hex[:12]}",
                "job_id": job_id,
                "candidate_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                "email": f"candidate{random.randint(100, 999)}@gmail.com",
                "phone": f"+91 98765{random.randint(10000, 99999)}",
                "experience_years": random.randint(2, 10),
                "current_company": random.choice(["TCS", "Infosys", "Wipro", "HCL", "Tech Mahindra", "Accenture"]),
                "current_ctc": random.randint(500000, 2000000),
                "expected_ctc": random.randint(700000, 2500000),
                "notice_period": random.choice([0, 15, 30, 60, 90]),
                "status": random.choice(["new", "screening", "interview", "offer", "rejected", "hired"]),
                "resume_url": None,
                "notes": "Good candidate" if random.random() > 0.5 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            applications.append(app)
    
    await db.job_postings.insert_many(job_postings)
    await db.job_applications.insert_many(applications)
    print(f"✅ Seeded {len(job_postings)} job postings and {len(applications)} applications")

async def seed_onboarding(employees):
    """Seed onboarding tasks"""
    tasks = []
    task_templates = [
        "Complete joining formalities",
        "Submit ID proof documents",
        "Submit educational certificates",
        "Complete bank account details",
        "Attend orientation session",
        "Setup workstation and email",
        "Meet team members",
        "Complete compliance training",
        "Review company policies",
        "Setup biometric access"
    ]
    
    # New joiners (last 5 employees)
    for emp in employees[-10:]:
        for task_name in task_templates:
            task = {
                "task_id": f"obt_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "task_name": task_name,
                "description": f"Complete {task_name.lower()}",
                "due_date": (datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                "status": random.choice(["pending", "in_progress", "completed"]),
                "assigned_to": "EMP002",
                "completed_date": datetime.now().strftime("%Y-%m-%d") if random.random() > 0.6 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            tasks.append(task)
    
    await db.onboarding_tasks.insert_many(tasks)
    print(f"✅ Seeded {len(tasks)} onboarding tasks")

async def seed_performance(employees):
    """Seed KPI records and goals"""
    kpi_records = []
    goals = []
    templates = []
    
    # KPI Templates
    template_data = [
        {"name": "Engineering KPI", "questions": [
            {"question_id": "q1", "question": "Code Quality", "max_points": 20},
            {"question_id": "q2", "question": "Project Delivery", "max_points": 25},
            {"question_id": "q3", "question": "Technical Skills", "max_points": 20},
            {"question_id": "q4", "question": "Team Collaboration", "max_points": 15},
            {"question_id": "q5", "question": "Innovation", "max_points": 20},
        ]},
        {"name": "Sales KPI", "questions": [
            {"question_id": "q1", "question": "Revenue Target Achievement", "max_points": 30},
            {"question_id": "q2", "question": "Client Acquisition", "max_points": 25},
            {"question_id": "q3", "question": "Customer Satisfaction", "max_points": 20},
            {"question_id": "q4", "question": "Pipeline Management", "max_points": 15},
            {"question_id": "q5", "question": "Cross-selling", "max_points": 10},
        ]},
        {"name": "General KPI", "questions": [
            {"question_id": "q1", "question": "Goal Achievement", "max_points": 25},
            {"question_id": "q2", "question": "Quality of Work", "max_points": 25},
            {"question_id": "q3", "question": "Communication", "max_points": 20},
            {"question_id": "q4", "question": "Teamwork", "max_points": 15},
            {"question_id": "q5", "question": "Initiative", "max_points": 15},
        ]},
    ]
    
    for t in template_data:
        template = {
            "template_id": f"kpi_{uuid.uuid4().hex[:12]}",
            "name": t["name"],
            "questions": t["questions"],
            "total_points": sum(q["max_points"] for q in t["questions"]),
            "period_type": "quarterly",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        templates.append(template)
    
    # KPI Records
    for emp in employees[:20]:
        for quarter in range(1, 4):
            kpi = {
                "kpi_id": f"kpir_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "template_id": templates[0]["template_id"],
                "period_type": "quarterly",
                "period_start": f"2025-{(quarter-1)*3+1:02d}-01",
                "period_end": f"2025-{quarter*3:02d}-{28 if quarter*3 == 2 else 30}",
                "self_rating": {q["question_id"]: random.randint(12, q["max_points"]) for q in templates[0]["questions"]},
                "manager_rating": {q["question_id"]: random.randint(10, q["max_points"]) for q in templates[0]["questions"]} if random.random() > 0.3 else None,
                "final_score": random.uniform(60, 95) if random.random() > 0.4 else None,
                "status": random.choice(["draft", "submitted", "under_review", "approved"]),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            kpi_records.append(kpi)
    
    # Goals
    goal_titles = [
        "Complete certification", "Improve customer satisfaction score",
        "Reduce bug count by 20%", "Achieve sales target", "Learn new technology",
        "Mentor junior team members", "Improve process efficiency", "Complete training"
    ]
    
    for emp in employees[:25]:
        for _ in range(random.randint(3, 6)):
            goal = {
                "goal_id": f"goal_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "title": random.choice(goal_titles),
                "description": "Goal description and success criteria",
                "target_date": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                "priority": random.choice(["low", "medium", "high"]),
                "progress": random.randint(0, 100),
                "status": random.choice(["not_started", "in_progress", "completed", "cancelled"]),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            goals.append(goal)
    
    await db.kpi_templates.insert_many(templates)
    await db.kpi_records.insert_many(kpi_records)
    await db.goals.insert_many(goals)
    print(f"✅ Seeded {len(templates)} KPI templates, {len(kpi_records)} KPI records, {len(goals)} goals")

async def seed_documents(employees):
    """Seed employee documents"""
    documents = []
    doc_types = ["ID Proof", "Address Proof", "Educational Certificate", "Experience Letter", "PAN Card", "Aadhar Card", "Bank Statement"]
    
    for emp in employees[:30]:
        for doc_type in random.sample(doc_types, random.randint(3, 6)):
            doc = {
                "document_id": f"doc_{uuid.uuid4().hex[:12]}",
                "employee_id": emp["employee_id"],
                "document_type": doc_type,
                "document_name": f"{emp['first_name']}_{doc_type.replace(' ', '_')}.pdf",
                "file_url": None,
                "file_size": random.randint(100000, 5000000),
                "uploaded_by": emp["employee_id"],
                "verified": random.choice([True, True, False]),
                "verified_by": "EMP002" if random.random() > 0.5 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            documents.append(doc)
    
    await db.documents.insert_many(documents)
    print(f"✅ Seeded {len(documents)} documents")

async def seed_announcements():
    """Seed announcements"""
    announcements = [
        {"title": "Republic Day Holiday", "content": "Office will remain closed on 26th January for Republic Day.", "type": "holiday", "priority": "high"},
        {"title": "Q4 Town Hall Meeting", "content": "All employees are invited to the Q4 Town Hall on Friday at 3 PM.", "type": "event", "priority": "medium"},
        {"title": "New Health Insurance Policy", "content": "We are pleased to announce enhanced health insurance coverage for all employees.", "type": "policy", "priority": "high"},
        {"title": "Annual Performance Review", "content": "Annual performance reviews will begin from next week. Please complete your self-assessment.", "type": "announcement", "priority": "high"},
        {"title": "Office Renovation Notice", "content": "3rd floor will be under renovation from 15th to 20th. Please use alternate seating.", "type": "notice", "priority": "medium"},
        {"title": "Star Performer Awards", "content": "Congratulations to this month's star performers!", "type": "achievement", "priority": "medium"},
        {"title": "IT System Maintenance", "content": "Scheduled maintenance on Saturday night. Systems may be unavailable from 11 PM to 2 AM.", "type": "notice", "priority": "low"},
        {"title": "New Joining - Welcome Aboard!", "content": "Please welcome our new team members who joined this month.", "type": "announcement", "priority": "low"},
    ]
    
    for i, ann in enumerate(announcements):
        ann["announcement_id"] = f"ann_{uuid.uuid4().hex[:12]}"
        ann["posted_by"] = "EMP002"
        ann["is_active"] = True
        ann["created_at"] = (datetime.now() - timedelta(days=i*3)).isoformat()
    
    await db.announcements.insert_many(announcements)
    print(f"✅ Seeded {len(announcements)} announcements")

async def seed_labour():
    """Seed contractors and workers"""
    contractors = []
    workers = []
    
    contractor_names = ["ABC Services", "XYZ Contractors", "PQR Manpower", "LMN Solutions", "DEF Staffing"]
    
    for i, name in enumerate(contractor_names):
        contractor_id = f"cont_{uuid.uuid4().hex[:12]}"
        contractor = {
            "contractor_id": contractor_id,
            "name": name,
            "contact_person": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "phone": f"+91 98765{random.randint(10000, 99999)}",
            "email": f"contact@{name.lower().replace(' ', '')}.com",
            "address": f"{random.randint(1, 100)} Industrial Area, Mumbai",
            "license_number": f"LIC{random.randint(10000, 99999)}",
            "license_expiry": (datetime.now() + timedelta(days=random.randint(100, 500))).strftime("%Y-%m-%d"),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        contractors.append(contractor)
        
        # Workers for each contractor
        for j in range(random.randint(5, 15)):
            worker = {
                "worker_id": f"wrk_{uuid.uuid4().hex[:12]}",
                "contractor_id": contractor_id,
                "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                "phone": f"+91 98765{random.randint(10000, 99999)}",
                "aadhar_number": f"{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                "skill": random.choice(["Security", "Housekeeping", "Electrician", "Plumber", "Driver", "Cafeteria"]),
                "daily_wage": random.randint(400, 800),
                "start_date": (datetime.now() - timedelta(days=random.randint(30, 300))).strftime("%Y-%m-%d"),
                "end_date": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                "status": random.choice(["active", "active", "inactive"]),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            workers.append(worker)
    
    await db.contractors.insert_many(contractors)
    await db.workers.insert_many(workers)
    print(f"✅ Seeded {len(contractors)} contractors and {len(workers)} workers")

async def seed_payroll(employees):
    """Seed payroll data"""
    payroll_runs = []
    payslips = []
    employee_salaries = []
    
    # Employee salaries
    salary_ranges = {
        "desig_ceo": (3000000, 5000000),
        "desig_vp": (2000000, 3000000),
        "desig_dir": (1500000, 2000000),
        "desig_mgr": (1000000, 1500000),
        "desig_lead": (800000, 1000000),
        "desig_sr": (600000, 800000),
        "desig_exec": (400000, 600000),
        "desig_jr": (300000, 400000),
        "desig_trainee": (200000, 300000),
    }
    
    for emp in employees:
        desig_id = emp.get("designation_id", "desig_exec")
        salary_range = salary_ranges.get(desig_id, (400000, 600000))
        annual_ctc = random.randint(salary_range[0], salary_range[1])
        monthly_gross = annual_ctc / 12
        
        salary = {
            "salary_id": f"sal_{uuid.uuid4().hex[:12]}",
            "employee_id": emp["employee_id"],
            "annual_ctc": annual_ctc,
            "gross": round(monthly_gross),
            "basic": round(monthly_gross * 0.4),
            "hra": round(monthly_gross * 0.16),
            "special_allowance": round(monthly_gross * 0.44),
            "effective_from": emp.get("date_of_joining", "2024-01-01"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employee_salaries.append(salary)
    
    # Payroll runs for last 6 months
    for month_offset in range(6):
        month_date = datetime.now() - timedelta(days=30 * month_offset)
        month = month_date.month
        year = month_date.year
        
        payroll_id = f"pr_{uuid.uuid4().hex[:12]}"
        total_gross = 0
        total_deductions = 0
        total_net = 0
        
        # Generate payslips
        for emp in employees[:40]:
            salary = next((s for s in employee_salaries if s["employee_id"] == emp["employee_id"]), None)
            if not salary:
                continue
            
            gross = salary["gross"]
            basic = salary["basic"]
            
            # Calculate deductions
            pf = min(basic, 15000) * 0.12
            esi = gross * 0.0075 if gross <= 21000 else 0
            pt = 200 if gross > 15000 else (150 if gross > 10000 else 0)
            total_ded = pf + esi + pt
            net = gross - total_ded
            
            payslip = {
                "payslip_id": f"ps_{uuid.uuid4().hex[:12]}",
                "payroll_id": payroll_id,
                "employee_id": emp["employee_id"],
                "month": month,
                "year": year,
                "working_days": 26,
                "present_days": random.randint(22, 26),
                "lwp_days": random.randint(0, 2),
                "paid_days": random.randint(24, 26),
                "basic": round(basic),
                "hra": round(basic * 0.4),
                "special_allowance": round(gross - basic - basic * 0.4),
                "gross_salary": round(gross),
                "pf_employee": round(pf),
                "pf_employer": round(pf),
                "esi_employee": round(esi),
                "esi_employer": round(gross * 0.0325) if esi > 0 else 0,
                "professional_tax": pt,
                "total_deductions": round(total_ded),
                "net_salary": round(net),
                "status": "processed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            payslips.append(payslip)
            
            total_gross += gross
            total_deductions += total_ded
            total_net += net
        
        payroll_run = {
            "payroll_id": payroll_id,
            "month": month,
            "year": year,
            "status": "processed" if month_offset > 0 else "draft",
            "total_employees": 40,
            "total_gross": round(total_gross),
            "total_deductions": round(total_deductions),
            "total_net": round(total_net),
            "total_pf": round(total_gross * 0.048),
            "total_esi": round(total_gross * 0.04),
            "total_pt": 40 * 200,
            "processed_at": datetime.now(timezone.utc).isoformat() if month_offset > 0 else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        payroll_runs.append(payroll_run)
    
    await db.employee_salaries.insert_many(employee_salaries)
    await db.payroll_runs.insert_many(payroll_runs)
    await db.payslips.insert_many(payslips)
    print(f"✅ Seeded {len(employee_salaries)} salary structures, {len(payroll_runs)} payroll runs, {len(payslips)} payslips")

async def main():
    print("\n🚀 Starting Comprehensive Test Data Seeding for Sharda HR\n")
    print("=" * 60)
    
    await clear_collections()
    await seed_master_data()
    employees = await seed_employees_and_users()
    await seed_attendance(employees)
    await seed_leave_requests(employees)
    await seed_expenses(employees)
    await seed_assets(employees)
    await seed_grievances(employees)
    await seed_recruitment()
    await seed_onboarding(employees)
    await seed_performance(employees)
    await seed_documents(employees)
    await seed_announcements()
    await seed_labour()
    await seed_payroll(employees)
    
    print("\n" + "=" * 60)
    print("✅ SEEDING COMPLETE!")
    print("=" * 60)
    print("\n📋 TEST ACCOUNTS:")
    print("-" * 40)
    print("🔑 Super Admin: admin@shardahr.com / Admin@123")
    print("🔑 HR Admin:    hr@shardahr.com / Hr@12345")
    print("🔑 Finance:     finance@shardahr.com / Finance@123")
    print("🔑 Manager:     manager@shardahr.com / Manager@123")
    print("🔑 Employee:    employee@shardahr.com / Employee@123")
    print("-" * 40)
    print("\n📊 DATA SUMMARY:")
    print(f"   • 50 Employees across 8 departments")
    print(f"   • 60 days of attendance records")
    print(f"   • Leave requests with various statuses")
    print(f"   • 100+ expense claims")
    print(f"   • 100 assets with assignments")
    print(f"   • Grievance tickets")
    print(f"   • 8 job postings with 80+ applications")
    print(f"   • Onboarding tasks for new joiners")
    print(f"   • KPI templates and records")
    print(f"   • Employee goals")
    print(f"   • Document records")
    print(f"   • Announcements")
    print(f"   • Contractors and workers")
    print(f"   • 6 months of payroll data")
    print("\n🎉 Ready for testing!\n")

if __name__ == "__main__":
    asyncio.run(main())
