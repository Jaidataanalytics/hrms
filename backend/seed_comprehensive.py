"""Comprehensive Test Data Seeder for Nexus HR"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import uuid
import random
import os
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Helper functions
def gen_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def random_date(start_days_ago, end_days_ago=0):
    days = random.randint(end_days_ago, start_days_ago)
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

def random_datetime(start_days_ago, end_days_ago=0):
    days = random.randint(end_days_ago, start_days_ago)
    hours = random.randint(0, 23)
    return (datetime.now(timezone.utc) - timedelta(days=days, hours=hours)).isoformat()

# Data pools
FIRST_NAMES = ["Amit", "Priya", "Rahul", "Sneha", "Vikram", "Anita", "Rajesh", "Kavita", "Suresh", "Meera",
               "Arun", "Deepa", "Nikhil", "Pooja", "Sanjay", "Ritu", "Ajay", "Neha", "Vivek", "Swati",
               "Kiran", "Anjali", "Rohit", "Divya", "Manish", "Preeti", "Gaurav", "Shweta", "Ashish", "Nisha",
               "Sachin", "Pallavi", "Vishal", "Megha", "Prakash", "Sunita", "Rakesh", "Jyoti", "Mohit", "Rekha",
               "Dinesh", "Sapna", "Pankaj", "Komal", "Varun", "Suman", "Harsh", "Seema", "Tarun", "Aarti"]

LAST_NAMES = ["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Mehta", "Reddy", "Nair",
              "Iyer", "Rao", "Das", "Chatterjee", "Banerjee", "Mukherjee", "Sen", "Bose", "Pillai", "Menon",
              "Agarwal", "Saxena", "Malhotra", "Kapoor", "Khanna", "Chopra", "Arora", "Sethi", "Bhatt", "Desai"]

SKILLS = ["Python", "Java", "React", "Node.js", "SQL", "AWS", "Docker", "Kubernetes", "Machine Learning",
          "Data Analysis", "Project Management", "Agile", "Scrum", "Leadership", "Communication"]

async def seed_all():
    print("🚀 Starting comprehensive data seeding...")
    
    # Clear existing data (except admin user)
    print("🗑️ Clearing existing test data...")
    collections_to_clear = [
        'departments', 'designations', 'locations', 'employees', 'users',
        'attendance', 'leave_requests', 'leave_balances', 'leave_types',
        'expenses', 'expense_categories', 'assets', 'asset_requests', 'asset_history',
        'grievances', 'announcements', 'job_postings', 'job_applications',
        'onboarding_tasks', 'onboarding_templates', 'exit_requests',
        'documents', 'document_types', 'contractors', 'contract_workers',
        'contract_worker_attendance', 'kpi_records', 'kpi_templates', 'goals',
        'payroll_runs', 'salary_structures', 'payslips', 'roles'
    ]
    for coll in collections_to_clear:
        await db[coll].delete_many({})
    
    # ==================== MASTER DATA ====================
    print("📊 Creating master data...")
    
    # Roles
    roles = [
        {"role_id": "super_admin", "name": "Super Admin", "permissions": ["all"], "is_active": True},
        {"role_id": "hr_admin", "name": "HR Admin", "permissions": ["hr", "employees", "payroll", "reports"], "is_active": True},
        {"role_id": "hr_executive", "name": "HR Executive", "permissions": ["hr", "employees"], "is_active": True},
        {"role_id": "manager", "name": "Manager", "permissions": ["team", "approvals"], "is_active": True},
        {"role_id": "finance", "name": "Finance", "permissions": ["payroll", "expenses", "reports"], "is_active": True},
        {"role_id": "it_admin", "name": "IT Admin", "permissions": ["assets", "it"], "is_active": True},
        {"role_id": "employee", "name": "Employee", "permissions": ["self"], "is_active": True}
    ]
    await db.roles.insert_many(roles)
    
    # Departments
    departments = [
        {"department_id": "dept_hr", "name": "Human Resources", "code": "HR", "is_active": True},
        {"department_id": "dept_eng", "name": "Engineering", "code": "ENG", "is_active": True},
        {"department_id": "dept_fin", "name": "Finance", "code": "FIN", "is_active": True},
        {"department_id": "dept_sales", "name": "Sales", "code": "SALES", "is_active": True},
        {"department_id": "dept_ops", "name": "Operations", "code": "OPS", "is_active": True},
        {"department_id": "dept_mkt", "name": "Marketing", "code": "MKT", "is_active": True},
        {"department_id": "dept_it", "name": "Information Technology", "code": "IT", "is_active": True},
        {"department_id": "dept_legal", "name": "Legal", "code": "LEGAL", "is_active": True},
        {"department_id": "dept_admin", "name": "Administration", "code": "ADMIN", "is_active": True},
        {"department_id": "dept_rd", "name": "Research & Development", "code": "R&D", "is_active": True}
    ]
    await db.departments.insert_many(departments)
    
    # Designations
    designations = [
        {"designation_id": "desig_ceo", "name": "Chief Executive Officer", "code": "CEO", "grade": "E1", "band": "Executive", "is_active": True},
        {"designation_id": "desig_cto", "name": "Chief Technology Officer", "code": "CTO", "grade": "E1", "band": "Executive", "is_active": True},
        {"designation_id": "desig_cfo", "name": "Chief Financial Officer", "code": "CFO", "grade": "E1", "band": "Executive", "is_active": True},
        {"designation_id": "desig_vp", "name": "Vice President", "code": "VP", "grade": "E2", "band": "Senior Leadership", "is_active": True},
        {"designation_id": "desig_dir", "name": "Director", "code": "DIR", "grade": "M1", "band": "Management", "is_active": True},
        {"designation_id": "desig_sr_mgr", "name": "Senior Manager", "code": "SR_MGR", "grade": "M2", "band": "Management", "is_active": True},
        {"designation_id": "desig_mgr", "name": "Manager", "code": "MGR", "grade": "M3", "band": "Management", "is_active": True},
        {"designation_id": "desig_lead", "name": "Team Lead", "code": "TL", "grade": "L1", "band": "Lead", "is_active": True},
        {"designation_id": "desig_sr", "name": "Senior Associate", "code": "SR", "grade": "L2", "band": "Senior", "is_active": True},
        {"designation_id": "desig_assoc", "name": "Associate", "code": "ASSOC", "grade": "L3", "band": "Associate", "is_active": True},
        {"designation_id": "desig_jr", "name": "Junior Associate", "code": "JR", "grade": "L4", "band": "Junior", "is_active": True},
        {"designation_id": "desig_intern", "name": "Intern", "code": "INT", "grade": "L5", "band": "Trainee", "is_active": True}
    ]
    await db.designations.insert_many(designations)
    
    # Locations
    locations = [
        {"location_id": "loc_mum", "name": "Mumbai HQ", "code": "MUM", "city": "Mumbai", "state": "Maharashtra", "address": "Bandra Kurla Complex", "pincode": "400051", "is_active": True},
        {"location_id": "loc_blr", "name": "Bangalore Tech Park", "code": "BLR", "city": "Bangalore", "state": "Karnataka", "address": "Electronic City", "pincode": "560100", "is_active": True},
        {"location_id": "loc_del", "name": "Delhi Office", "code": "DEL", "city": "New Delhi", "state": "Delhi", "address": "Connaught Place", "pincode": "110001", "is_active": True},
        {"location_id": "loc_hyd", "name": "Hyderabad Campus", "code": "HYD", "city": "Hyderabad", "state": "Telangana", "address": "HITEC City", "pincode": "500081", "is_active": True},
        {"location_id": "loc_pun", "name": "Pune Development Center", "code": "PUN", "city": "Pune", "state": "Maharashtra", "address": "Hinjewadi IT Park", "pincode": "411057", "is_active": True}
    ]
    await db.locations.insert_many(locations)
    
    # Leave Types
    leave_types = [
        {"leave_type_id": "lt_cl", "code": "CL", "name": "Casual Leave", "total_days": 12, "carry_forward": False, "is_active": True},
        {"leave_type_id": "lt_sl", "code": "SL", "name": "Sick Leave", "total_days": 12, "carry_forward": False, "is_active": True},
        {"leave_type_id": "lt_pl", "code": "PL", "name": "Privilege Leave", "total_days": 15, "carry_forward": True, "max_carry": 30, "is_active": True},
        {"leave_type_id": "lt_ml", "code": "ML", "name": "Maternity Leave", "total_days": 182, "carry_forward": False, "is_active": True},
        {"leave_type_id": "lt_ptl", "code": "PTL", "name": "Paternity Leave", "total_days": 15, "carry_forward": False, "is_active": True},
        {"leave_type_id": "lt_comp", "code": "COMP", "name": "Compensatory Off", "total_days": 0, "carry_forward": False, "is_active": True},
        {"leave_type_id": "lt_lop", "code": "LOP", "name": "Loss of Pay", "total_days": 999, "carry_forward": False, "is_active": True}
    ]
    await db.leave_types.insert_many(leave_types)
    
    # Expense Categories
    expense_categories = [
        {"code": "travel", "name": "Travel", "limit": 50000, "requires_receipt": True},
        {"code": "food", "name": "Food & Meals", "limit": 10000, "requires_receipt": True},
        {"code": "accommodation", "name": "Accommodation", "limit": 25000, "requires_receipt": True},
        {"code": "client_entertainment", "name": "Client Entertainment", "limit": 20000, "requires_receipt": True},
        {"code": "fuel", "name": "Fuel", "limit": 15000, "requires_receipt": True},
        {"code": "office_supplies", "name": "Office Supplies", "limit": 5000, "requires_receipt": False},
        {"code": "communication", "name": "Communication", "limit": 5000, "requires_receipt": True},
        {"code": "training", "name": "Training & Certification", "limit": 100000, "requires_receipt": True},
        {"code": "medical", "name": "Medical Reimbursement", "limit": 50000, "requires_receipt": True},
        {"code": "other", "name": "Other", "limit": 10000, "requires_receipt": True}
    ]
    await db.expense_categories.insert_many(expense_categories)
    
    # Document Types
    document_types = [
        {"type_id": "id_proof", "name": "ID Proof (Govt. Issued)", "code": "ID", "is_mandatory": True},
        {"type_id": "address_proof", "name": "Address Proof", "code": "ADDR", "is_mandatory": True},
        {"type_id": "pan_card", "name": "PAN Card", "code": "PAN", "is_mandatory": True},
        {"type_id": "aadhaar", "name": "Aadhaar Card", "code": "AADH", "is_mandatory": True},
        {"type_id": "education_10", "name": "10th Certificate", "code": "EDU10", "is_mandatory": True},
        {"type_id": "education_12", "name": "12th Certificate", "code": "EDU12", "is_mandatory": True},
        {"type_id": "education_grad", "name": "Graduation Certificate", "code": "GRAD", "is_mandatory": True},
        {"type_id": "education_pg", "name": "Post Graduation Certificate", "code": "PG", "is_mandatory": False},
        {"type_id": "experience_letter", "name": "Experience Letter", "code": "EXP", "is_mandatory": False},
        {"type_id": "relieving_letter", "name": "Relieving Letter", "code": "REL", "is_mandatory": False},
        {"type_id": "payslips", "name": "Last 3 Months Payslips", "code": "PAY", "is_mandatory": False},
        {"type_id": "offer_letter", "name": "Offer Letter", "code": "OL", "is_mandatory": False},
        {"type_id": "bank_details", "name": "Bank Details/Cancelled Cheque", "code": "BANK", "is_mandatory": True},
        {"type_id": "photo", "name": "Passport Size Photo", "code": "PHOTO", "is_mandatory": True}
    ]
    await db.document_types.insert_many(document_types)
    
    # ==================== USERS & EMPLOYEES ====================
    print("👥 Creating 55 employees...")
    
    employees = []
    users = []
    
    # Admin user
    admin_user = {
        "user_id": "user_admin_001",
        "email": "admin@nexushr.com",
        "password_hash": pwd_context.hash("Admin@123"),
        "name": "System Administrator",
        "role": "super_admin",
        "employee_id": "EMP000001",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(admin_user)
    
    admin_emp = {
        "employee_id": "EMP000001",
        "emp_code": "ADM001",
        "user_id": "user_admin_001",
        "first_name": "System",
        "last_name": "Administrator",
        "email": "admin@nexushr.com",
        "phone": "9876543210",
        "department_id": "dept_it",
        "designation_id": "desig_dir",
        "location_id": "loc_mum",
        "reporting_manager": None,
        "employment_type": "permanent",
        "employment_status": "active",
        "date_of_joining": "2020-01-01",
        "date_of_birth": "1985-05-15",
        "gender": "male",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(admin_emp)
    
    # Create department heads and managers first
    dept_heads = {}
    managers = {}
    
    dept_list = [d["department_id"] for d in departments]
    desig_list = [d["designation_id"] for d in designations]
    loc_list = [l["location_id"] for l in locations]
    
    emp_counter = 2
    
    # Create HR Admin
    hr_admin_user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": "hr.admin@nexushr.com",
        "password_hash": pwd_context.hash("HrAdmin@123"),
        "name": "Priya Sharma",
        "role": "hr_admin",
        "employee_id": f"EMP{str(emp_counter).zfill(6)}",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(hr_admin_user)
    
    hr_admin_emp = {
        "employee_id": f"EMP{str(emp_counter).zfill(6)}",
        "emp_code": f"HR{str(emp_counter).zfill(3)}",
        "user_id": hr_admin_user["user_id"],
        "first_name": "Priya",
        "last_name": "Sharma",
        "email": "hr.admin@nexushr.com",
        "phone": "9876543211",
        "department_id": "dept_hr",
        "designation_id": "desig_dir",
        "location_id": "loc_mum",
        "reporting_manager": "EMP000001",
        "employment_type": "permanent",
        "employment_status": "active",
        "date_of_joining": "2020-03-15",
        "date_of_birth": "1988-08-20",
        "gender": "female",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(hr_admin_emp)
    dept_heads["dept_hr"] = hr_admin_emp["employee_id"]
    emp_counter += 1
    
    # Create Finance Head
    fin_head_user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": "finance.head@nexushr.com",
        "password_hash": pwd_context.hash("Finance@123"),
        "name": "Rajesh Kumar",
        "role": "finance",
        "employee_id": f"EMP{str(emp_counter).zfill(6)}",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(fin_head_user)
    
    fin_head_emp = {
        "employee_id": f"EMP{str(emp_counter).zfill(6)}",
        "emp_code": f"FIN{str(emp_counter).zfill(3)}",
        "user_id": fin_head_user["user_id"],
        "first_name": "Rajesh",
        "last_name": "Kumar",
        "email": "finance.head@nexushr.com",
        "phone": "9876543212",
        "department_id": "dept_fin",
        "designation_id": "desig_dir",
        "location_id": "loc_mum",
        "reporting_manager": "EMP000001",
        "employment_type": "permanent",
        "employment_status": "active",
        "date_of_joining": "2020-02-01",
        "date_of_birth": "1982-11-10",
        "gender": "male",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    employees.append(fin_head_emp)
    dept_heads["dept_fin"] = fin_head_emp["employee_id"]
    emp_counter += 1
    
    # Create managers for each department
    for dept in departments:
        if dept["department_id"] in ["dept_hr", "dept_fin"]:
            continue
            
        mgr_user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": f"manager.{dept['code'].lower()}@nexushr.com",
            "password_hash": pwd_context.hash("Manager@123"),
            "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "role": "manager",
            "employee_id": f"EMP{str(emp_counter).zfill(6)}",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        users.append(mgr_user)
        
        name_parts = mgr_user["name"].split()
        mgr_emp = {
            "employee_id": f"EMP{str(emp_counter).zfill(6)}",
            "emp_code": f"{dept['code']}{str(emp_counter).zfill(3)}",
            "user_id": mgr_user["user_id"],
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "email": mgr_user["email"],
            "phone": f"98765{random.randint(10000, 99999)}",
            "department_id": dept["department_id"],
            "designation_id": "desig_mgr",
            "location_id": random.choice(loc_list),
            "reporting_manager": "EMP000001",
            "employment_type": "permanent",
            "employment_status": "active",
            "date_of_joining": random_date(1500, 365),
            "date_of_birth": random_date(15000, 10000),
            "gender": random.choice(["male", "female"]),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employees.append(mgr_emp)
        dept_heads[dept["department_id"]] = mgr_emp["employee_id"]
        managers[dept["department_id"]] = mgr_emp["employee_id"]
        emp_counter += 1
    
    # Create regular employees
    for i in range(45):
        dept = random.choice(dept_list)
        desig = random.choice(["desig_sr", "desig_assoc", "desig_jr", "desig_lead"])
        loc = random.choice(loc_list)
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        
        emp_user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": f"{first_name.lower()}.{last_name.lower()}{emp_counter}@nexushr.com",
            "password_hash": pwd_context.hash("Employee@123"),
            "name": f"{first_name} {last_name}",
            "role": "employee",
            "employee_id": f"EMP{str(emp_counter).zfill(6)}",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        users.append(emp_user)
        
        emp = {
            "employee_id": f"EMP{str(emp_counter).zfill(6)}",
            "emp_code": f"EMP{str(emp_counter).zfill(3)}",
            "user_id": emp_user["user_id"],
            "first_name": first_name,
            "last_name": last_name,
            "email": emp_user["email"],
            "phone": f"98{random.randint(10000000, 99999999)}",
            "department_id": dept,
            "designation_id": desig,
            "location_id": loc,
            "reporting_manager": dept_heads.get(dept, "EMP000001"),
            "employment_type": random.choice(["permanent", "permanent", "permanent", "contract", "probation"]),
            "employment_status": "active",
            "date_of_joining": random_date(1500, 30),
            "date_of_birth": random_date(18000, 8000),
            "gender": random.choice(["male", "female"]),
            "skills": random.sample(SKILLS, random.randint(2, 5)),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        employees.append(emp)
        emp_counter += 1
    
    await db.users.insert_many(users)
    await db.employees.insert_many(employees)
    
    # ==================== LEAVE BALANCES ====================
    print("🏖️ Creating leave balances...")
    leave_balances = []
    for emp in employees:
        for lt in leave_types:
            if lt["code"] in ["ML", "PTL"] and random.random() > 0.3:
                continue
            balance = {
                "balance_id": gen_id("lb"),
                "employee_id": emp["employee_id"],
                "leave_type_id": lt["leave_type_id"],
                "year": 2025,
                "total_days": lt["total_days"],
                "used_days": random.randint(0, min(8, lt["total_days"])),
                "pending_days": random.randint(0, 3),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            balance["available_days"] = balance["total_days"] - balance["used_days"] - balance["pending_days"]
            leave_balances.append(balance)
    await db.leave_balances.insert_many(leave_balances)
    
    # ==================== LEAVE REQUESTS ====================
    print("📝 Creating leave requests...")
    leave_requests = []
    statuses = ["pending", "pending", "approved", "approved", "approved", "rejected"]
    
    for _ in range(80):
        emp = random.choice(employees[1:])  # Exclude admin
        lt = random.choice(leave_types[:3])  # CL, SL, PL
        start = random_date(60, 1)
        days = random.randint(1, 5)
        status = random.choice(statuses)
        
        lr = {
            "request_id": gen_id("lr"),
            "employee_id": emp["employee_id"],
            "leave_type_id": lt["leave_type_id"],
            "start_date": start,
            "end_date": (datetime.fromisoformat(start) + timedelta(days=days-1)).date().isoformat(),
            "days": days,
            "reason": random.choice([
                "Personal work", "Family function", "Medical appointment",
                "Out of station", "Festival celebration", "Home emergency",
                "Feeling unwell", "Doctor's appointment", "Family vacation"
            ]),
            "status": status,
            "applied_on": random_datetime(65, 5),
            "approved_by": dept_heads.get(emp["department_id"]) if status == "approved" else None,
            "approved_on": random_datetime(60, 1) if status == "approved" else None,
            "rejection_reason": "Insufficient leave balance" if status == "rejected" else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        leave_requests.append(lr)
    await db.leave_requests.insert_many(leave_requests)
    
    # ==================== ATTENDANCE ====================
    print("📅 Creating attendance records (30 days)...")
    attendance_records = []
    
    for day_offset in range(30):
        date = (datetime.now(timezone.utc) - timedelta(days=day_offset)).date()
        if date.weekday() >= 5:  # Skip weekends
            continue
            
        for emp in employees:
            status = random.choices(
                ["present", "present", "present", "present", "absent", "leave", "wfh"],
                weights=[60, 15, 10, 5, 3, 5, 2]
            )[0]
            
            if status == "present" or status == "wfh":
                first_in = f"{random.randint(8, 10)}:{random.randint(0, 59):02d}"
                last_out = f"{random.randint(17, 20)}:{random.randint(0, 59):02d}"
            else:
                first_in = None
                last_out = None
            
            att = {
                "attendance_id": gen_id("att"),
                "employee_id": emp["employee_id"],
                "date": date.isoformat(),
                "status": status,
                "first_in": first_in,
                "last_out": last_out,
                "work_hours": random.uniform(7.5, 10.5) if first_in else 0,
                "overtime_hours": random.uniform(0, 2) if random.random() > 0.7 else 0,
                "source": random.choice(["biometric", "manual", "wfh"]),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            attendance_records.append(att)
    
    await db.attendance.insert_many(attendance_records)
    
    # ==================== EXPENSES ====================
    print("💰 Creating expense claims...")
    expenses = []
    expense_statuses = ["pending", "pending", "approved", "approved", "rejected", "reimbursed"]
    
    for _ in range(60):
        emp = random.choice(employees[1:])
        cat = random.choice(expense_categories)
        status = random.choice(expense_statuses)
        amount = random.randint(500, min(cat["limit"], 25000))
        
        exp = {
            "claim_id": gen_id("exp"),
            "employee_id": emp["employee_id"],
            "title": f"{cat['name']} - {random.choice(['Project meeting', 'Client visit', 'Training', 'Team outing', 'Office supplies'])}",
            "category": cat["code"],
            "amount": amount,
            "expense_date": random_date(45, 1),
            "description": f"Expense for {cat['name'].lower()} related activity",
            "receipt_url": f"https://storage.nexushr.com/receipts/{uuid.uuid4().hex}.pdf" if random.random() > 0.2 else None,
            "status": status,
            "approved_amount": amount if status in ["approved", "reimbursed"] else None,
            "approved_by": dept_heads.get(emp["department_id"]) if status in ["approved", "reimbursed"] else None,
            "approved_at": random_datetime(40, 1) if status in ["approved", "reimbursed"] else None,
            "rejection_reason": "Missing receipt" if status == "rejected" else None,
            "reimbursed_at": random_datetime(30, 1) if status == "reimbursed" else None,
            "currency": "INR",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        expenses.append(exp)
    await db.expenses.insert_many(expenses)
    
    # ==================== ASSETS ====================
    print("📦 Creating assets...")
    assets = []
    asset_categories = ["laptop", "monitor", "keyboard", "mouse", "headset", "phone", "tablet", "chair", "desk"]
    asset_brands = ["Dell", "HP", "Lenovo", "Apple", "Logitech", "Samsung", "LG", "Herman Miller"]
    
    for i in range(100):
        cat = random.choice(asset_categories)
        is_assigned = random.random() > 0.3
        
        asset = {
            "asset_id": gen_id("ast"),
            "name": f"{random.choice(asset_brands)} {cat.title()}",
            "asset_tag": f"AST-{str(i+1).zfill(5)}",
            "category": cat,
            "brand": random.choice(asset_brands),
            "model": f"Model-{random.randint(100, 999)}",
            "serial_number": f"SN{uuid.uuid4().hex[:10].upper()}",
            "purchase_date": random_date(1000, 30),
            "purchase_cost": random.randint(5000, 150000),
            "warranty_expiry": random_date(-365, -730),  # Future date
            "condition": random.choice(["excellent", "good", "good", "fair"]),
            "status": "assigned" if is_assigned else "available",
            "assigned_to": random.choice(employees)["employee_id"] if is_assigned else None,
            "assigned_date": random_date(365, 1) if is_assigned else None,
            "location_id": random.choice(loc_list),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        assets.append(asset)
    await db.assets.insert_many(assets)
    
    # Asset Requests
    asset_requests = []
    for _ in range(15):
        emp = random.choice(employees[1:])
        req = {
            "request_id": gen_id("areq"),
            "employee_id": emp["employee_id"],
            "category": random.choice(asset_categories),
            "description": f"Need {random.choice(['new', 'replacement', 'additional'])} {random.choice(asset_categories)}",
            "justification": "Required for work",
            "status": random.choice(["pending", "pending", "approved", "rejected"]),
            "created_at": random_datetime(30, 1)
        }
        asset_requests.append(req)
    await db.asset_requests.insert_many(asset_requests)
    
    # ==================== GRIEVANCES ====================
    print("🎫 Creating helpdesk tickets...")
    grievances = []
    grievance_categories = ["general", "payroll", "leave", "workplace", "benefits", "it_support", "policy", "feedback"]
    
    for _ in range(35):
        emp = random.choice(employees[1:])
        status = random.choice(["open", "open", "in_progress", "resolved", "closed"])
        
        ticket = {
            "ticket_id": f"TKT-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}",
            "employee_id": emp["employee_id"],
            "employee_name": f"{emp['first_name']} {emp['last_name']}",
            "category": random.choice(grievance_categories),
            "subject": random.choice([
                "Query about leave policy",
                "Salary discrepancy",
                "System access issue",
                "Workplace concern",
                "Benefits clarification",
                "Policy clarification needed",
                "Request for equipment",
                "General feedback"
            ]),
            "description": "Detailed description of the issue or query that needs to be addressed by the HR team.",
            "priority": random.choice(["low", "medium", "medium", "high"]),
            "status": status,
            "is_anonymous": random.random() > 0.9,
            "assigned_to": dept_heads.get("dept_hr") if status in ["in_progress", "resolved"] else None,
            "resolution": "Issue has been resolved as per discussion." if status in ["resolved", "closed"] else None,
            "resolved_at": random_datetime(20, 1) if status in ["resolved", "closed"] else None,
            "comments": [],
            "created_at": random_datetime(45, 1),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        grievances.append(ticket)
    await db.grievances.insert_many(grievances)
    
    # ==================== ANNOUNCEMENTS ====================
    print("📢 Creating announcements...")
    announcements = []
    announcement_types = ["general", "event", "policy", "holiday", "achievement", "urgent"]
    
    announcement_titles = [
        ("Welcome New Joiners - December 2024", "general"),
        ("Annual Day Celebration - Save the Date!", "event"),
        ("Updated Leave Policy 2025", "policy"),
        ("Republic Day Holiday - 26th January", "holiday"),
        ("Q3 Star Performers Announced", "achievement"),
        ("Office Closure - System Maintenance", "urgent"),
        ("Health Insurance Enrollment Open", "policy"),
        ("Town Hall Meeting - This Friday", "event"),
        ("New Cafeteria Menu", "general"),
        ("IT Security Awareness Training", "policy"),
        ("Diwali Bonus Announcement", "achievement"),
        ("Work From Home Guidelines Updated", "policy")
    ]
    
    for title, cat in announcement_titles:
        ann = {
            "announcement_id": gen_id("ann"),
            "title": title,
            "content": f"This is a detailed announcement about {title.lower()}. Please read carefully and take necessary action.",
            "category": cat,
            "priority": "high" if cat == "urgent" else "normal",
            "is_pinned": cat == "urgent",
            "target_departments": [] if random.random() > 0.3 else [random.choice(dept_list)],
            "target_locations": [],
            "valid_from": random_date(30, 0),
            "valid_until": random_date(-30, -60),
            "created_by": dept_heads.get("dept_hr"),
            "is_active": True,
            "views": random.randint(10, 150),
            "created_at": random_datetime(30, 1)
        }
        announcements.append(ann)
    await db.announcements.insert_many(announcements)
    
    # ==================== JOB POSTINGS & APPLICATIONS ====================
    print("💼 Creating job postings and applications...")
    job_postings = []
    job_titles = [
        ("Senior Software Engineer", "dept_eng", "desig_sr"),
        ("Marketing Manager", "dept_mkt", "desig_mgr"),
        ("Financial Analyst", "dept_fin", "desig_assoc"),
        ("HR Executive", "dept_hr", "desig_assoc"),
        ("Sales Representative", "dept_sales", "desig_jr"),
        ("DevOps Engineer", "dept_it", "desig_sr"),
        ("Legal Counsel", "dept_legal", "desig_sr"),
        ("Operations Coordinator", "dept_ops", "desig_assoc")
    ]
    
    for title, dept, desig in job_titles:
        status = random.choice(["draft", "published", "published", "published", "closed"])
        job = {
            "job_id": f"JOB-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}",
            "title": title,
            "department_id": dept,
            "designation_id": desig,
            "location_id": random.choice(loc_list),
            "job_type": "full_time",
            "description": f"We are looking for a talented {title} to join our team.",
            "requirements": "Relevant experience and skills required.",
            "skills_required": random.sample(SKILLS, 3),
            "experience_min": random.randint(1, 5),
            "experience_max": random.randint(6, 10),
            "salary_min": random.randint(500000, 1000000),
            "salary_max": random.randint(1200000, 2500000),
            "vacancies": random.randint(1, 3),
            "hiring_manager": dept_heads.get(dept),
            "status": status,
            "is_internal": True,
            "is_active": True,
            "created_by": dept_heads.get("dept_hr"),
            "created_at": random_datetime(60, 1),
            "published_at": random_datetime(55, 1) if status in ["published", "closed"] else None
        }
        job_postings.append(job)
    await db.job_postings.insert_many(job_postings)
    
    # Job Applications
    job_applications = []
    for _ in range(25):
        emp = random.choice(employees[5:])  # Exclude leadership
        job = random.choice([j for j in job_postings if j["status"] == "published"])
        
        app = {
            "application_id": f"APP-{uuid.uuid4().hex[:10].upper()}",
            "job_id": job["job_id"],
            "employee_id": emp["employee_id"],
            "employee_name": f"{emp['first_name']} {emp['last_name']}",
            "current_department": emp["department_id"],
            "current_designation": emp["designation_id"],
            "cover_letter": "I am interested in this position and believe my skills align well with the requirements.",
            "status": random.choice(["applied", "applied", "screening", "interview", "selected", "rejected"]),
            "created_at": random_datetime(45, 1)
        }
        job_applications.append(app)
    await db.job_applications.insert_many(job_applications)
    
    # ==================== DOCUMENTS ====================
    print("📄 Creating employee documents...")
    documents = []
    
    for emp in employees:
        # Each employee has some documents
        num_docs = random.randint(3, 8)
        doc_types_for_emp = random.sample(document_types, min(num_docs, len(document_types)))
        
        for dt in doc_types_for_emp:
            doc = {
                "document_id": gen_id("doc"),
                "employee_id": emp["employee_id"],
                "name": f"{emp['first_name']}'s {dt['name']}",
                "type": dt["type_id"],
                "description": f"Submitted {dt['name']}",
                "file_url": f"https://storage.nexushr.com/docs/{uuid.uuid4().hex}.pdf",
                "file_size": random.randint(100000, 5000000),
                "is_verified": random.random() > 0.3,
                "verified_by": dept_heads.get("dept_hr") if random.random() > 0.3 else None,
                "verified_at": random_datetime(90, 1) if random.random() > 0.3 else None,
                "uploaded_at": random_datetime(180, 30),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            documents.append(doc)
    await db.documents.insert_many(documents)
    
    # ==================== CONTRACTORS & WORKERS ====================
    print("👷 Creating contractors and contract workers...")
    contractors = []
    contract_workers = []
    
    contractor_companies = [
        ("ABC Manpower Services", "Staffing"),
        ("XYZ Security Solutions", "Security"),
        ("CleanPro Services", "Housekeeping"),
        ("TechForce IT Solutions", "IT Support"),
        ("BuildRight Construction", "Maintenance")
    ]
    
    for name, service in contractor_companies:
        cont = {
            "contractor_id": f"CONT-{uuid.uuid4().hex[:8].upper()}",
            "name": name,
            "company_name": name,
            "contact_person": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "email": f"contact@{name.lower().replace(' ', '')}.com",
            "phone": f"98{random.randint(10000000, 99999999)}",
            "gst_number": f"29{uuid.uuid4().hex[:10].upper()}",
            "pan_number": f"AAAC{uuid.uuid4().hex[:5].upper()}",
            "department_id": random.choice(dept_list),
            "contract_start": random_date(365, 180),
            "contract_end": random_date(-180, -365),
            "contract_value": random.randint(500000, 5000000),
            "status": "active",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        contractors.append(cont)
        
        # Workers for this contractor
        for _ in range(random.randint(3, 8)):
            worker = {
                "worker_id": f"CW-{uuid.uuid4().hex[:8].upper()}",
                "contractor_id": cont["contractor_id"],
                "first_name": random.choice(FIRST_NAMES),
                "last_name": random.choice(LAST_NAMES),
                "phone": f"98{random.randint(10000000, 99999999)}",
                "aadhaar_number": f"{random.randint(100000000000, 999999999999)}",
                "department_id": random.choice(dept_list),
                "location_id": random.choice(loc_list),
                "skill_category": random.choice(["skilled", "semi_skilled", "unskilled"]),
                "daily_rate": random.randint(400, 1200),
                "start_date": random_date(180, 30),
                "status": "active",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            contract_workers.append(worker)
    
    await db.contractors.insert_many(contractors)
    await db.contract_workers.insert_many(contract_workers)
    
    # Contract Worker Attendance
    cw_attendance = []
    for day_offset in range(14):
        date = (datetime.now(timezone.utc) - timedelta(days=day_offset)).date()
        if date.weekday() >= 5:
            continue
        for worker in contract_workers:
            status = random.choice(["present", "present", "present", "absent"])
            att = {
                "attendance_id": gen_id("cwa"),
                "worker_id": worker["worker_id"],
                "contractor_id": worker["contractor_id"],
                "date": date.isoformat(),
                "status": status,
                "in_time": f"{random.randint(7, 9)}:{random.randint(0, 59):02d}" if status == "present" else None,
                "out_time": f"{random.randint(17, 19)}:{random.randint(0, 59):02d}" if status == "present" else None,
                "hours_worked": random.uniform(8, 10) if status == "present" else 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            cw_attendance.append(att)
    await db.contract_worker_attendance.insert_many(cw_attendance)
    
    # ==================== KPI & PERFORMANCE ====================
    print("📊 Creating KPI and performance data...")
    kpi_templates = [
        {"template_id": gen_id("kpit"), "name": "Sales Target", "category": "sales", "max_score": 100, "weight": 30, "is_active": True},
        {"template_id": gen_id("kpit"), "name": "Customer Satisfaction", "category": "quality", "max_score": 100, "weight": 20, "is_active": True},
        {"template_id": gen_id("kpit"), "name": "Project Delivery", "category": "delivery", "max_score": 100, "weight": 25, "is_active": True},
        {"template_id": gen_id("kpit"), "name": "Team Collaboration", "category": "teamwork", "max_score": 100, "weight": 15, "is_active": True},
        {"template_id": gen_id("kpit"), "name": "Innovation", "category": "innovation", "max_score": 100, "weight": 10, "is_active": True}
    ]
    await db.kpi_templates.insert_many(kpi_templates)
    
    kpi_records = []
    for emp in employees[1:30]:  # KPIs for some employees
        for template in random.sample(kpi_templates, 3):
            kpi = {
                "kpi_id": gen_id("kpi"),
                "employee_id": emp["employee_id"],
                "template_id": template["template_id"],
                "template_name": template["name"],
                "period": "Q4 2024",
                "target": random.randint(70, 100),
                "achieved": random.randint(50, 110),
                "score": random.randint(60, 100),
                "status": random.choice(["draft", "submitted", "reviewed", "approved"]),
                "reviewer_id": dept_heads.get(emp["department_id"]),
                "reviewer_comments": "Good performance" if random.random() > 0.5 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            kpi_records.append(kpi)
    await db.kpi_records.insert_many(kpi_records)
    
    # Goals
    goals = []
    goal_titles = ["Complete certification", "Improve team productivity", "Launch new feature", "Reduce costs", "Improve customer NPS"]
    for emp in employees[1:25]:
        for _ in range(random.randint(1, 3)):
            goal = {
                "goal_id": gen_id("goal"),
                "employee_id": emp["employee_id"],
                "title": random.choice(goal_titles),
                "description": "Detailed goal description",
                "target_date": random_date(-90, -180),
                "progress": random.randint(0, 100),
                "status": random.choice(["not_started", "in_progress", "in_progress", "completed"]),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            goals.append(goal)
    await db.goals.insert_many(goals)
    
    # ==================== PAYROLL ====================
    print("💵 Creating salary structures and payroll...")
    salary_structures = []
    for emp in employees:
        ctc = random.randint(400000, 3000000)
        basic = ctc * 0.4
        hra = basic * 0.5
        
        sal = {
            "structure_id": gen_id("sal"),
            "employee_id": emp["employee_id"],
            "ctc": ctc,
            "basic": basic,
            "hra": hra,
            "special_allowance": ctc * 0.15,
            "conveyance": 19200,
            "medical": 15000,
            "lta": ctc * 0.05,
            "pf_employee": basic * 0.12,
            "pf_employer": basic * 0.12,
            "esi_employee": 0 if ctc > 252000 else ctc * 0.0075,
            "professional_tax": 200,
            "effective_from": "2024-04-01",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        salary_structures.append(sal)
    await db.salary_structures.insert_many(salary_structures)
    
    # Payroll Runs
    payroll_runs = []
    payslips = []
    
    for month in range(9, 13):  # Sep to Dec 2024
        run = {
            "run_id": gen_id("pr"),
            "month": month,
            "year": 2024,
            "status": "completed" if month < 12 else "processing",
            "total_employees": len(employees),
            "total_gross": sum(s["ctc"]/12 for s in salary_structures),
            "total_deductions": sum(s["pf_employee"] + s["professional_tax"] for s in salary_structures),
            "total_net": sum(s["ctc"]/12 - s["pf_employee"] - s["professional_tax"] for s in salary_structures),
            "processed_by": dept_heads.get("dept_fin"),
            "processed_at": f"2024-{month:02d}-28T10:00:00+00:00",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        payroll_runs.append(run)
        
        # Payslips for each employee
        for sal in salary_structures:
            gross = sal["ctc"] / 12
            deductions = sal["pf_employee"] + sal["professional_tax"] + sal.get("esi_employee", 0)
            net = gross - deductions
            
            slip = {
                "payslip_id": gen_id("ps"),
                "run_id": run["run_id"],
                "employee_id": sal["employee_id"],
                "month": month,
                "year": 2024,
                "basic": sal["basic"] / 12,
                "hra": sal["hra"] / 12,
                "special_allowance": sal["special_allowance"] / 12,
                "conveyance": sal["conveyance"] / 12,
                "medical": sal["medical"] / 12,
                "gross": gross,
                "pf_deduction": sal["pf_employee"],
                "professional_tax": sal["professional_tax"],
                "esi_deduction": sal.get("esi_employee", 0),
                "total_deductions": deductions,
                "net_pay": net,
                "payment_status": "paid" if month < 12 else "pending",
                "payment_date": f"2024-{month:02d}-30" if month < 12 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            payslips.append(slip)
    
    await db.payroll_runs.insert_many(payroll_runs)
    await db.payslips.insert_many(payslips)
    
    # ==================== ONBOARDING & EXIT ====================
    print("🚪 Creating onboarding tasks and exit requests...")
    
    # Onboarding tasks for recent joiners
    onboarding_tasks = []
    recent_employees = [e for e in employees if e.get("date_of_joining", "") > random_date(90)][:10]
    
    task_templates = [
        ("Submit KYC documents", "documents"),
        ("Complete IT setup", "it_setup"),
        ("HR orientation session", "training"),
        ("Department introduction", "introduction"),
        ("Safety training", "training"),
        ("Set up email and tools", "it_setup"),
        ("Meet reporting manager", "introduction"),
        ("Review company policies", "training")
    ]
    
    for emp in recent_employees:
        for title, category in task_templates:
            task = {
                "task_id": gen_id("onb"),
                "employee_id": emp["employee_id"],
                "title": title,
                "description": f"Complete: {title}",
                "category": category,
                "assigned_to": emp["employee_id"],
                "due_date": random_date(-7, -30),
                "status": random.choice(["pending", "pending", "completed", "completed"]),
                "priority": "high" if category == "documents" else "medium",
                "completed_at": random_datetime(20, 1) if random.random() > 0.4 else None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            onboarding_tasks.append(task)
    await db.onboarding_tasks.insert_many(onboarding_tasks)
    
    # Exit requests
    exit_requests = []
    for _ in range(5):
        emp = random.choice(employees[10:])
        status = random.choice(["pending", "approved", "in_notice", "completed", "withdrawn"])
        
        exit_req = {
            "request_id": f"EXIT-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}",
            "employee_id": emp["employee_id"],
            "employee_name": f"{emp['first_name']} {emp['last_name']}",
            "resignation_date": random_date(30, 5),
            "requested_last_day": random_date(-30, -60),
            "reason": random.choice(["Better opportunity", "Personal reasons", "Relocation", "Higher studies"]),
            "reason_category": random.choice(["career", "personal", "relocation", "other"]),
            "status": status,
            "notice_period_days": 30,
            "actual_last_day": random_date(-30, -45) if status in ["approved", "in_notice", "completed"] else None,
            "approved_by": dept_heads.get("dept_hr") if status != "pending" else None,
            "clearance_status": {
                "hr": {"cleared": status == "completed", "cleared_at": random_datetime(10, 1) if status == "completed" else None},
                "it": {"cleared": status == "completed", "cleared_at": random_datetime(10, 1) if status == "completed" else None},
                "finance": {"cleared": status == "completed", "cleared_at": random_datetime(10, 1) if status == "completed" else None}
            } if status in ["in_notice", "completed"] else {},
            "created_at": random_datetime(45, 1)
        }
        exit_requests.append(exit_req)
    await db.exit_requests.insert_many(exit_requests)
    
    print("\n" + "="*50)
    print("✅ COMPREHENSIVE DATA SEEDING COMPLETE!")
    print("="*50)
    print(f"""
📊 Summary:
   - Users: {len(users)}
   - Employees: {len(employees)}
   - Departments: {len(departments)}
   - Designations: {len(designations)}
   - Locations: {len(locations)}
   - Leave Requests: {len(leave_requests)}
   - Attendance Records: {len(attendance_records)}
   - Expenses: {len(expenses)}
   - Assets: {len(assets)}
   - Asset Requests: {len(asset_requests)}
   - Grievance Tickets: {len(grievances)}
   - Announcements: {len(announcements)}
   - Job Postings: {len(job_postings)}
   - Job Applications: {len(job_applications)}
   - Documents: {len(documents)}
   - Contractors: {len(contractors)}
   - Contract Workers: {len(contract_workers)}
   - KPI Records: {len(kpi_records)}
   - Goals: {len(goals)}
   - Salary Structures: {len(salary_structures)}
   - Payroll Runs: {len(payroll_runs)}
   - Payslips: {len(payslips)}
   - Onboarding Tasks: {len(onboarding_tasks)}
   - Exit Requests: {len(exit_requests)}

🔐 Test Credentials:
   - Admin: admin@nexushr.com / Admin@123
   - HR Admin: hr.admin@nexushr.com / HrAdmin@123
   - Finance: finance.head@nexushr.com / Finance@123
   - Managers: manager.<dept>@nexushr.com / Manager@123
   - Employees: <firstname>.<lastname><num>@nexushr.com / Employee@123
""")

if __name__ == "__main__":
    asyncio.run(seed_all())
