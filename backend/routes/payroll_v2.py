"""Enhanced Payroll Calculation Module - Based on Salary Structure Template"""

from datetime import datetime, timezone, date
from calendar import monthrange
import uuid


def get_calendar_days_in_month(year: int, month: int) -> int:
    """Get actual calendar days in a month"""
    return monthrange(year, month)[1]


def is_second_saturday(year: int, month: int, day: int) -> bool:
    """Check if a date is the second Saturday of the month"""
    d = date(year, month, day)
    if d.weekday() != 5:  # Not Saturday
        return False
    
    # Count Saturdays in the month up to this date
    saturday_count = 0
    for check_day in range(1, day + 1):
        check_date = date(year, month, check_day)
        if check_date.weekday() == 5:
            saturday_count += 1
    
    return saturday_count == 2


def calculate_earned_days(
    office_days: float,
    sundays_holidays: float,
    leave_days: float,
    wfh_days: float,
    half_day_count: float = 0,
    wfh_percentage: float = 50.0
) -> float:
    """
    Calculate total earned days for salary proration
    
    Formula: Total Earned Days = Office Days + Sundays/Holidays + (WFH Days * WFH%) + (Half Days * 0.5)
    """
    wfh_earned = wfh_days * (wfh_percentage / 100.0)
    half_day_earned = half_day_count * 0.5
    return office_days + sundays_holidays + wfh_earned + half_day_earned


def prorate_component(fixed_amount: float, earned_days: float, total_days: int) -> float:
    """
    Pro-rate a salary component based on earned days
    
    Formula: Earned = Fixed × (Earned Days / Total Days in Month)
    """
    if total_days <= 0:
        return 0
    return (fixed_amount / total_days) * earned_days


def calculate_epf(basic_earned: float, epf_applicable: bool, epf_percentage: float = 12.0, epf_ceiling: float = 15000) -> float:
    """
    Calculate EPF deduction
    
    Formula: 12% of Basic (capped at ₹15,000 ceiling)
    """
    if not epf_applicable:
        return 0
    
    epf_base = min(basic_earned, epf_ceiling)
    return round(epf_base * (epf_percentage / 100), 2)


def calculate_esi(gross_earned: float, esi_applicable: bool, esi_percentage: float = 0.75, esi_ceiling: float = 21000) -> float:
    """
    Calculate ESI deduction
    
    Formula: 0.75% of Gross (only if Gross ≤ ₹21,000)
    """
    if not esi_applicable:
        return 0
    
    if gross_earned > esi_ceiling:
        return 0
    
    return round(gross_earned * (esi_percentage / 100), 2)


def calculate_sewa(basic_earned: float, sewa_applicable: bool, sewa_percentage: float = 2.0) -> float:
    """
    Calculate SEWA deduction
    
    Formula: 2% of Basic
    """
    if not sewa_applicable:
        return 0
    
    return round(basic_earned * (sewa_percentage / 100), 2)


def calculate_late_deduction(
    late_count: int,
    weekly_late_threshold: int,
    daily_rate: float,
    late_deduction_enabled: bool = True
) -> float:
    """
    Calculate late deduction based on late count
    
    Rule: 2 lates in a week = half day deduction
    """
    if not late_deduction_enabled or late_count < weekly_late_threshold:
        return 0
    
    # For every 2 lates, deduct half day
    half_days_deducted = late_count // weekly_late_threshold
    return round(half_days_deducted * (daily_rate * 0.5), 2)


def process_employee_salary(
    employee_salary: dict,
    attendance_data: dict,
    payroll_config: dict,
    month: int,
    year: int,
    sewa_advance_info: dict = None,
    one_time_deductions: list = None
) -> dict:
    """
    Process salary for a single employee based on the salary structure template
    
    Returns complete payslip data
    """
    # Get calendar days in month
    total_days = get_calendar_days_in_month(year, month)
    
    # Extract fixed components
    fixed_components = employee_salary.get("fixed_components", {})
    basic = float(fixed_components.get("basic", 0))
    da = float(fixed_components.get("da", 0))
    hra = float(fixed_components.get("hra", 0))
    conveyance = float(fixed_components.get("conveyance", 0))
    grade_pay = float(fixed_components.get("grade_pay", 0))
    other_allowance = float(fixed_components.get("other_allowance", 0))
    medical_allowance = float(fixed_components.get("medical_allowance", 0))
    
    total_fixed = basic + da + hra + conveyance + grade_pay + other_allowance + medical_allowance
    
    # If no fixed components, try legacy structure
    if total_fixed <= 0:
        total_fixed = float(employee_salary.get("total_fixed", 0)) or float(employee_salary.get("gross", 0))
        basic = float(employee_salary.get("basic", total_fixed * 0.4))
        hra = float(employee_salary.get("hra", basic * 0.4))
        da = float(employee_salary.get("da", 0))
        conveyance = float(employee_salary.get("conveyance", 0))
        other_allowance = float(employee_salary.get("other_allowance", 0))
        medical_allowance = total_fixed - basic - da - hra - conveyance
    
    # Get deduction config
    deduction_config = employee_salary.get("deduction_config", {})
    epf_applicable = deduction_config.get("epf_applicable", True)
    esi_applicable = deduction_config.get("esi_applicable", True)
    sewa_applicable = deduction_config.get("sewa_applicable", True)
    sewa_percentage = float(deduction_config.get("sewa_percentage", 2.0))
    
    # Get payroll config values
    epf_percentage = float(payroll_config.get("epf_employee_percentage", 12.0))
    epf_ceiling = float(payroll_config.get("epf_wage_ceiling", 15000))
    esi_percentage = float(payroll_config.get("esi_employee_percentage", 0.75))
    esi_ceiling = float(payroll_config.get("esi_wage_ceiling", 21000))
    wfh_percentage = float(payroll_config.get("wfh_pay_percentage", 50.0))
    late_deduction_enabled = payroll_config.get("late_deduction_enabled", True)
    late_count_threshold = int(payroll_config.get("late_count_threshold", 2))
    
    # Get attendance data
    office_days = float(attendance_data.get("office_days", 0))
    sundays_holidays = float(attendance_data.get("sundays_holidays", 0))
    leave_days = float(attendance_data.get("leave_days", 0))
    wfh_days = float(attendance_data.get("wfh_days", 0))
    late_count = int(attendance_data.get("late_count", 0))
    
    # Calculate earned days
    total_earned_days = calculate_earned_days(
        office_days, sundays_holidays, leave_days, wfh_days, wfh_percentage
    )
    
    # Pro-rate each component
    basic_da_earned = prorate_component(basic + da, total_earned_days, total_days)
    hra_earned = prorate_component(hra, total_earned_days, total_days)
    conveyance_earned = prorate_component(conveyance, total_earned_days, total_days)
    grade_pay_earned = prorate_component(grade_pay, total_earned_days, total_days)
    other_allowance_earned = prorate_component(other_allowance, total_earned_days, total_days)
    medical_allowance_earned = prorate_component(medical_allowance, total_earned_days, total_days)
    
    total_salary_earned = (
        basic_da_earned + hra_earned + conveyance_earned + 
        grade_pay_earned + other_allowance_earned + medical_allowance_earned
    )
    
    # Calculate daily rate for deductions
    daily_rate = total_fixed / total_days if total_days > 0 else 0
    
    # Calculate late deduction
    late_deduction = calculate_late_deduction(
        late_count, late_count_threshold, daily_rate, late_deduction_enabled
    )
    
    # Adjust total earned for late deduction
    total_salary_earned -= late_deduction
    
    # Calculate statutory deductions
    epf_deduction = calculate_epf(basic_da_earned, epf_applicable, epf_percentage, epf_ceiling)
    esi_deduction = calculate_esi(total_salary_earned, esi_applicable, esi_percentage, esi_ceiling)
    sewa_deduction = calculate_sewa(basic_da_earned, sewa_applicable, sewa_percentage)
    
    # Handle SEWA Advance
    sewa_advance = 0
    if sewa_advance_info and sewa_advance_info.get("is_active"):
        sewa_advance = float(sewa_advance_info.get("monthly_amount", 0))
    
    # Handle one-time/other deductions
    other_deduction = 0
    if one_time_deductions:
        for ded in one_time_deductions:
            if ded.get("month") == month and ded.get("year") == year:
                other_deduction += float(ded.get("amount", 0))
    
    # Also check fixed deductions from salary structure
    fixed_deductions = employee_salary.get("fixed_deductions", {})
    other_deduction += float(fixed_deductions.get("other_deduction", 0))
    
    # Total deductions
    total_deductions = epf_deduction + esi_deduction + sewa_deduction + sewa_advance + other_deduction
    
    # Net payable
    net_payable = total_salary_earned - total_deductions
    
    return {
        # Fixed components (for reference)
        "fixed_components": {
            "basic": round(basic, 2),
            "da": round(da, 2),
            "hra": round(hra, 2),
            "conveyance": round(conveyance, 2),
            "grade_pay": round(grade_pay, 2),
            "other_allowance": round(other_allowance, 2),
            "medical_allowance": round(medical_allowance, 2),
            "total_fixed": round(total_fixed, 2)
        },
        
        # Attendance
        "attendance": {
            "office_days": office_days,
            "sundays_holidays": sundays_holidays,
            "leave_days": leave_days,
            "wfh_days": wfh_days,
            "late_count": late_count,
            "total_earned_days": round(total_earned_days, 2),
            "total_days_in_month": total_days
        },
        
        # Earned amounts (prorated)
        "earnings": {
            "basic_da_earned": round(basic_da_earned, 2),
            "hra_earned": round(hra_earned, 2),
            "conveyance_earned": round(conveyance_earned, 2),
            "grade_pay_earned": round(grade_pay_earned, 2),
            "other_allowance_earned": round(other_allowance_earned, 2),
            "medical_allowance_earned": round(medical_allowance_earned, 2),
            "total_salary_earned": round(total_salary_earned + late_deduction, 2),  # Before late deduction
            "late_deduction": round(late_deduction, 2),
            "net_earned_after_late": round(total_salary_earned, 2)
        },
        
        # Deductions
        "deductions": {
            "epf": round(epf_deduction, 2),
            "esi": round(esi_deduction, 2),
            "sewa": round(sewa_deduction, 2),
            "sewa_advance": round(sewa_advance, 2),
            "other_deduction": round(other_deduction, 2),
            "total_deductions": round(total_deductions, 2)
        },
        
        # Summary
        "gross_salary": round(total_salary_earned, 2),
        "total_deductions": round(total_deductions, 2),
        "net_payable": round(net_payable, 2),
        
        # Config used
        "config_used": {
            "epf_percentage": epf_percentage,
            "epf_ceiling": epf_ceiling,
            "esi_percentage": esi_percentage,
            "esi_ceiling": esi_ceiling,
            "sewa_percentage": sewa_percentage,
            "wfh_percentage": wfh_percentage
        }
    }


def generate_payroll_export_data(payslips: list, month: int, year: int) -> list:
    """
    Generate data for Excel export in the same format as the salary structure template
    
    Columns: Emp Code, Name, BASIC, DA, HRA, Conveyance, GRADE PAY, OTHER ALLOW, Med./Spl. Allow,
             Total Salary (FIXED), Work from office, Sunday + Holiday, Leave Days, Work from Home @50%,
             Late Deduction, Basic+DA (Earned), HRA (Earned), Conveyance (Earned), GRADE PAY (Earned),
             OTHER ALLOW (Earned), Med./Spl. Allow (Earned), Total Earned Days, Total Salary Earned,
             EPF Employees, ESI Employees, SEWA, Sewa Advance, Other Deduction, Total Deduction, NET PAYABLE
    """
    export_data = []
    
    for slip in payslips:
        fc = slip.get("fixed_components", {})
        att = slip.get("attendance", {})
        earn = slip.get("earnings", {})
        ded = slip.get("deductions", {})
        
        row = {
            "Emp Code": slip.get("emp_code", ""),
            "Name of Employees": slip.get("employee_name", ""),
            "BASIC": fc.get("basic", 0),
            "DA": fc.get("da", 0),
            "HRA": fc.get("hra", 0),
            "Conveyance": fc.get("conveyance", 0),
            "GRADE PAY": fc.get("grade_pay", 0),
            "OTHER ALLOW": fc.get("other_allowance", 0),
            "Med./Spl. Allow": fc.get("medical_allowance", 0),
            "Total Salary (FIXED)": fc.get("total_fixed", 0),
            "Work from office": att.get("office_days", 0),
            "Sunday + Holiday Leave Days": att.get("sundays_holidays", 0),
            "Leave Days": att.get("leave_days", 0),
            "Work from Home @50%": att.get("wfh_days", 0),
            "Late Deduction": earn.get("late_deduction", 0),
            "Basic+DA (Earned)": earn.get("basic_da_earned", 0),
            "HRA (Earned)": earn.get("hra_earned", 0),
            "Conveyance (Earned)": earn.get("conveyance_earned", 0),
            "GRADE PAY (Earned)": earn.get("grade_pay_earned", 0),
            "OTHER ALLOW (Earned)": earn.get("other_allowance_earned", 0),
            "Med./Spl. Allow (Earned)": earn.get("medical_allowance_earned", 0),
            "Total Earned Days": att.get("total_earned_days", 0),
            "Total Salary Earned": slip.get("gross_salary", 0),
            "EPF Employees": ded.get("epf", 0),
            "ESI Employees": ded.get("esi", 0),
            "SEWA": ded.get("sewa", 0),
            "Sewa Advance": ded.get("sewa_advance", 0),
            "Other Deduction": ded.get("other_deduction", 0),
            "Total Deduction": ded.get("total_deductions", 0),
            "NET PAYABLE": slip.get("net_payable", 0)
        }
        export_data.append(row)
    
    return export_data
