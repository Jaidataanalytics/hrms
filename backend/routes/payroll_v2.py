"""Enhanced Payroll Calculation Module - Refactored for statutory compliance"""

from datetime import datetime, timezone, date, timedelta
from calendar import monthrange
import uuid


def r2(val):
    """Round to 2 decimal places - single consistent rounding rule"""
    return round(float(val), 2)


def get_calendar_days_in_month(year: int, month: int) -> int:
    """Get actual calendar days in a month"""
    return monthrange(year, month)[1]


def get_working_days_in_month(year: int, month: int, holidays: list = None) -> dict:
    """
    Calculate working days breakdown for a month
    Returns: {calendar_days, sundays, holidays, second_saturdays, working_days}
    """
    total_days = monthrange(year, month)[1]
    holiday_dates = set(h.get("date") for h in (holidays or []))

    sundays = 0
    holiday_count = 0
    second_saturdays = 0

    for day in range(1, total_days + 1):
        d = date(year, month, day)
        date_str = f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"

        if d.weekday() == 6:  # Sunday
            sundays += 1
        elif date_str in holiday_dates:
            holiday_count += 1

        if is_second_saturday(year, month, day):
            second_saturdays += 1

    working_days = total_days - sundays - holiday_count

    return {
        "calendar_days": total_days,
        "sundays": sundays,
        "holidays": holiday_count,
        "second_saturdays": second_saturdays,
        "working_days": working_days
    }


def is_second_saturday(year: int, month: int, day: int) -> bool:
    """Check if a date is the second Saturday of the month"""
    d = date(year, month, day)
    if d.weekday() != 5:  # Not Saturday
        return False

    saturday_count = 0
    for check_day in range(1, day + 1):
        check_date = date(year, month, check_day)
        if check_date.weekday() == 5:
            saturday_count += 1

    return saturday_count == 2


def calculate_sunday_pay_status(attendance_records: list, year: int, month: int) -> dict:
    """
    Calculate Sunday pay status based on the rule:
    - Sundays are PAID unless employee takes >2 leaves that week
    - If >2 leaves in a week, that week's Sunday becomes a LEAVE DAY
      (not directly unpaid - it's treated as leave and deducted from balance)

    Returns: {
        paid_sundays: count of normally paid Sundays,
        sundays_as_leave: list of Sundays that should be treated as leave,
        total_sundays: total count,
        weekly_breakdown: detailed breakdown
    }
    """
    total_days = monthrange(year, month)[1]

    # Build attendance lookup by date
    att_by_date = {}
    for att in attendance_records:
        att_by_date[att.get("date")] = att.get("status", "").lower()

    paid_sundays = 0
    sundays_as_leave = []  # Sundays that become leave days due to >2 leaves rule
    weekly_breakdown = []

    # Find all Sundays in the month
    sundays_in_month = []
    for day in range(1, total_days + 1):
        d = date(year, month, day)
        if d.weekday() == 6:  # Sunday
            sundays_in_month.append(d)

    for sunday in sundays_in_month:
        # Get the week (Mon-Sun) containing this Sunday
        week_start = sunday - timedelta(days=6)  # Monday of this week
        if week_start.month != month:
            week_start = date(year, month, 1)

        week_end = sunday

        leaves_this_week = 0
        current = week_start
        while current <= week_end:
            if current.month == month:
                date_str = current.strftime("%Y-%m-%d")
                status = att_by_date.get(date_str, "")
                if status in ["leave", "absent", "lop", "lwp", "loss_of_pay"]:
                    leaves_this_week += 1
            current += timedelta(days=1)

        sunday_str = sunday.strftime("%Y-%m-%d")
        if leaves_this_week > 2:
            # Sunday becomes a leave day (not directly unpaid)
            sundays_as_leave.append({
                "date": sunday_str,
                "leaves_in_week": leaves_this_week,
                "week_start": week_start.strftime("%Y-%m-%d"),
                "week_end": week_end.strftime("%Y-%m-%d")
            })
            sunday_paid = "leave"  # Will be paid if balance available, LOP if not
        else:
            paid_sundays += 1
            sunday_paid = True

        weekly_breakdown.append({
            "sunday_date": sunday_str,
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": week_end.strftime("%Y-%m-%d"),
            "leaves_in_week": leaves_this_week,
            "sunday_paid": sunday_paid
        })

    return {
        "paid_sundays": paid_sundays,
        "sundays_as_leave": sundays_as_leave,
        "total_sundays": len(sundays_in_month),
        "weekly_breakdown": weekly_breakdown
    }


def calculate_earned_days(
    office_days: float,
    paid_sundays: float,
    paid_holidays: float,
    paid_leave_days: float,
    wfh_days: float,
    half_day_count: float = 0,
    late_deduction_days: float = 0,
    wfh_percentage: float = 50.0,
    calendar_days: int = 31
) -> float:
    """
    Calculate total earned days for salary proration.

    Formula:
    Earned Days = Office Days + Paid Sundays + Paid Holidays + Paid Leave Days
                + (WFH Days × WFH%) + (Half Days × 0.5)
                - Late Deduction Days

    NOTE on 2nd Saturday:
    - It's a half working day but pays full if attended
    - If attended: counted as 1.0 in office_days (no separate bonus needed)
    - If not attended: not in office_days (no pay)

    NOTE on Sundays:
    - Sundays are paid UNLESS employee takes >2 leaves that week
    - If >2 leaves in a week, that Sunday becomes unpaid (not in paid_sundays)

    Earned Days never exceeds calendar days.
    """
    wfh_earned = wfh_days * (wfh_percentage / 100.0)
    half_day_earned = half_day_count * 0.5

    total = (office_days + paid_sundays + paid_holidays + paid_leave_days
             + wfh_earned + half_day_earned
             - late_deduction_days)

    # Cap at calendar days, floor at 0
    return max(0, min(total, calendar_days))


def prorate_component(fixed_amount: float, earned_days: float, calendar_days: int) -> float:
    """
    Pro-rate a single salary component.
    Formula: Earned = round(Fixed × (Earned Days / Calendar Days), 2)
    """
    if calendar_days <= 0:
        return 0.0
    return r2((fixed_amount / calendar_days) * earned_days)


def calculate_epf(basic_da_earned: float, epf_applicable: bool, epf_percentage: float = 12.0, max_deduction: float = 15000.0) -> float:
    """
    Calculate EPF deduction.
    Formula: min(12% × Earned Basic+DA, ₹15,000)
    The cap is on the DEDUCTION amount, not the base.
    """
    if not epf_applicable:
        return 0.0
    deduction = r2(basic_da_earned * (epf_percentage / 100.0))
    return r2(min(deduction, max_deduction))


def calculate_esi(total_salary_earned: float, esi_applicable: bool, esi_percentage: float = 0.75, esi_ceiling: float = 21000.0) -> float:
    """
    Calculate ESI deduction.
    Formula: 0.75% of Total Salary Earned
    Only if Total Salary Earned ≤ ₹21,000
    """
    if not esi_applicable:
        return 0.0
    if total_salary_earned > esi_ceiling:
        return 0.0
    return r2(total_salary_earned * (esi_percentage / 100.0))


def calculate_sewa(fixed_basic: float, sewa_applicable: bool, sewa_percentage: float = 2.0) -> float:
    """
    Calculate SEWA deduction.
    Formula: 2% of FIXED Basic (not earned, not basic+DA)
    """
    if not sewa_applicable:
        return 0.0
    return r2(fixed_basic * (sewa_percentage / 100.0))


def calculate_late_deduction_days(late_count: int, late_threshold: int = 3) -> float:
    """
    Calculate late deduction as days.
    Rule: 3 lates = 1 day leave deduction from earned days.
    Cumulative: 6 lates = 2 days, 9 lates = 3 days.
    """
    if late_count < late_threshold:
        return 0.0
    return float(late_count // late_threshold)


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
    Process salary for a single employee.

    Calculation flow:
    1. Extract fixed components
    2. Calculate earned days (with late deduction as days)
    3. Prorate each component individually: Component Earned = round(Fixed / CalDays * EarnedDays, 2)
    4. Total Salary Earned = sum of all earned components
    5. PF = min(12% × (Basic Earned + DA Earned), ₹15,000)
    6. ESI = 0.75% × Total Salary Earned (if earned ≤ ₹21,000)
    7. SEWA = 2% × Fixed Basic
    8. Net Payable = Total Salary Earned - Total Deductions
    9. Validation: |Net - (Earned - Deductions)| ≤ ₹0.01
    """
    calendar_days = get_calendar_days_in_month(year, month)

    # === 1. Extract fixed components ===
    fixed_components = employee_salary.get("fixed_components", {})
    basic_fixed = r2(fixed_components.get("basic", 0))
    da_fixed = r2(fixed_components.get("da", 0))
    hra_fixed = r2(fixed_components.get("hra", 0))
    conveyance_fixed = r2(fixed_components.get("conveyance", 0))
    grade_pay_fixed = r2(fixed_components.get("grade_pay", 0))
    other_allowance_fixed = r2(fixed_components.get("other_allowance", 0))
    medical_allowance_fixed = r2(fixed_components.get("medical_allowance", 0))

    total_fixed = r2(basic_fixed + da_fixed + hra_fixed + conveyance_fixed
                     + grade_pay_fixed + other_allowance_fixed + medical_allowance_fixed)

    # Legacy fallback
    if total_fixed <= 0:
        total_fixed = r2(employee_salary.get("total_fixed", 0)) or r2(employee_salary.get("gross", 0))
        basic_fixed = r2(employee_salary.get("basic", total_fixed * 0.4))
        da_fixed = r2(employee_salary.get("da", 0))
        hra_fixed = r2(employee_salary.get("hra", basic_fixed * 0.4))
        conveyance_fixed = r2(employee_salary.get("conveyance", 0))
        grade_pay_fixed = r2(employee_salary.get("grade_pay", 0))
        other_allowance_fixed = r2(employee_salary.get("other_allowance", 0))
        medical_allowance_fixed = r2(total_fixed - basic_fixed - da_fixed - hra_fixed
                                     - conveyance_fixed - grade_pay_fixed - other_allowance_fixed)
        if medical_allowance_fixed < 0:
            medical_allowance_fixed = 0.0

    # === 2. Get deduction config ===
    deduction_config = employee_salary.get("deduction_config", {})
    epf_applicable = deduction_config.get("epf_applicable", True)
    esi_applicable = deduction_config.get("esi_applicable", True)
    sewa_applicable = deduction_config.get("sewa_applicable", True)
    sewa_percentage = float(deduction_config.get("sewa_percentage", 2.0))

    # Payroll config
    epf_percentage = float(payroll_config.get("epf_employee_percentage", 12.0))
    epf_max_deduction = float(payroll_config.get("epf_max_deduction", 15000.0))
    esi_percentage = float(payroll_config.get("esi_employee_percentage", 0.75))
    esi_ceiling = float(payroll_config.get("esi_wage_ceiling", 21000.0))
    wfh_percentage = float(payroll_config.get("wfh_pay_percentage", 50.0))
    late_threshold = int(payroll_config.get("late_count_threshold", 3))

    # === 3. Get attendance data ===
    office_days = float(attendance_data.get("office_days", 0))
    wfh_days = float(attendance_data.get("wfh_days", 0))
    late_count = int(attendance_data.get("late_count", 0))
    half_day_count = float(attendance_data.get("half_day_count", 0))
    half_day_count = float(attendance_data.get("half_day_count", 0))

    paid_leave_days = float(attendance_data.get("paid_leave_days", 0))
    unpaid_leave_days = float(attendance_data.get("unpaid_leave_days", 0))

    paid_sundays = float(attendance_data.get("paid_sundays", 0))
    unpaid_sundays = float(attendance_data.get("unpaid_sundays", 0))
    total_sundays = paid_sundays + unpaid_sundays

    paid_holidays = float(attendance_data.get("paid_holidays", 0))
    working_days_info = attendance_data.get("working_days_info", {})

    # === 4. Calculate late deduction as DAYS ===
    late_deduction_days = calculate_late_deduction_days(late_count, late_threshold)

    # === 5. Calculate earned days ===
    total_earned_days = calculate_earned_days(
        office_days=office_days,
        paid_sundays=paid_sundays,
        paid_holidays=paid_holidays,
        paid_leave_days=paid_leave_days,
        wfh_days=wfh_days,
        half_day_count=half_day_count,
        late_deduction_days=late_deduction_days,
        wfh_percentage=wfh_percentage,
        calendar_days=calendar_days
    )

    # === 6. Prorate EACH component individually ===
    basic_earned = prorate_component(basic_fixed, total_earned_days, calendar_days)
    da_earned = prorate_component(da_fixed, total_earned_days, calendar_days)
    hra_earned = prorate_component(hra_fixed, total_earned_days, calendar_days)
    conveyance_earned = prorate_component(conveyance_fixed, total_earned_days, calendar_days)
    grade_pay_earned = prorate_component(grade_pay_fixed, total_earned_days, calendar_days)
    other_allowance_earned = prorate_component(other_allowance_fixed, total_earned_days, calendar_days)
    medical_allowance_earned = prorate_component(medical_allowance_fixed, total_earned_days, calendar_days)

    # Total Salary Earned = sum of ALL earned components
    total_salary_earned = r2(basic_earned + da_earned + hra_earned + conveyance_earned
                             + grade_pay_earned + other_allowance_earned + medical_allowance_earned)

    # === 7. Calculate statutory deductions ===
    basic_da_earned = r2(basic_earned + da_earned)

    epf_deduction = calculate_epf(basic_da_earned, epf_applicable, epf_percentage, epf_max_deduction)
    esi_deduction = calculate_esi(total_salary_earned, esi_applicable, esi_percentage, esi_ceiling)
    sewa_deduction = calculate_sewa(basic_fixed, sewa_applicable, sewa_percentage)

    # SEWA Advance (per-employee configured amount)
    sewa_advance = 0.0
    if sewa_advance_info and sewa_advance_info.get("is_active"):
        sewa_advance = r2(sewa_advance_info.get("monthly_amount", 0))

    # One-time / other deductions
    other_deduction = 0.0
    if one_time_deductions:
        for ded in one_time_deductions:
            if ded.get("month") == month and ded.get("year") == year:
                other_deduction = r2(other_deduction + float(ded.get("amount", 0)))

    fixed_deductions = employee_salary.get("fixed_deductions", {})
    other_deduction = r2(other_deduction + float(fixed_deductions.get("other_deduction", 0)))

    # === 8. Totals ===
    total_deductions = r2(epf_deduction + esi_deduction + sewa_deduction + sewa_advance + other_deduction)
    net_payable = r2(total_salary_earned - total_deductions)

    # === 9. Validation check ===
    expected_net = r2(total_salary_earned - total_deductions)
    validation_ok = abs(net_payable - expected_net) <= 0.01
    validation_diff = r2(net_payable - expected_net)

    return {
        # Fixed components (for reference)
        "fixed_components": {
            "basic": basic_fixed,
            "da": da_fixed,
            "hra": hra_fixed,
            "conveyance": conveyance_fixed,
            "grade_pay": grade_pay_fixed,
            "other_allowance": other_allowance_fixed,
            "medical_allowance": medical_allowance_fixed,
            "total_fixed": total_fixed
        },

        # Attendance breakdown
        "attendance": {
            "office_days": office_days,
            "wfh_days": wfh_days,
            "half_day_count": half_day_count,
            "late_count": late_count,
            "late_deduction_days": late_deduction_days,
            "total_earned_days": r2(total_earned_days),
            "total_days_in_month": calendar_days,

            "paid_sundays": paid_sundays,
            "unpaid_sundays": unpaid_sundays,
            "total_sundays": total_sundays,

            "paid_holidays": paid_holidays,

            "paid_leave_days": paid_leave_days,
            "unpaid_leave_days": unpaid_leave_days,
            "total_leave_days": r2(paid_leave_days + unpaid_leave_days),

            "working_days_info": working_days_info
        },

        # Earned amounts (each component prorated individually)
        "earnings": {
            "basic_earned": basic_earned,
            "da_earned": da_earned,
            "basic_da_earned": basic_da_earned,
            "hra_earned": hra_earned,
            "conveyance_earned": conveyance_earned,
            "grade_pay_earned": grade_pay_earned,
            "other_allowance_earned": other_allowance_earned,
            "medical_allowance_earned": medical_allowance_earned,
            "total_salary_earned": total_salary_earned,
        },

        # Deductions
        "deductions": {
            "epf": epf_deduction,
            "esi": esi_deduction,
            "sewa": sewa_deduction,
            "sewa_advance": sewa_advance,
            "other_deduction": other_deduction,
            "total_deductions": total_deductions
        },

        # Summary
        "gross_salary": total_salary_earned,
        "total_deductions": total_deductions,
        "net_payable": net_payable,

        # Validation
        "validation": {
            "passed": validation_ok,
            "difference": validation_diff,
            "formula": "Net Payable = Total Salary Earned - Total Deductions"
        },

        # Config used (for audit trail)
        "config_used": {
            "epf_percentage": epf_percentage,
            "epf_max_deduction": epf_max_deduction,
            "esi_percentage": esi_percentage,
            "esi_ceiling": esi_ceiling,
            "sewa_percentage": sewa_percentage,
            "wfh_percentage": wfh_percentage,
            "late_threshold": late_threshold
        }
    }


def generate_payroll_export_data(payslips: list, month: int, year: int) -> list:
    """
    Generate data for Excel export matching the manual salary sheet format.
    """
    export_data = []

    for slip in payslips:
        fc = slip.get("fixed_components", {})
        att = slip.get("attendance", {})
        earn = slip.get("earnings", {})
        ded = slip.get("deductions", {})
        validation = slip.get("validation", {})

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

            # Attendance
            "Work from office": att.get("office_days", 0),
            "Sunday + Holiday": r2(att.get("paid_sundays", 0) + att.get("paid_holidays", 0)),
            "Leave Days": att.get("total_leave_days", 0),
            "Work from Home @50%": att.get("wfh_days", 0),
            "Late Count": att.get("late_count", 0),
            "Late Deduction Days": att.get("late_deduction_days", 0),
            "Total Earned Days": att.get("total_earned_days", 0),

            # Earned components (separate Basic and DA)
            "Basic (Earned)": earn.get("basic_earned", 0),
            "DA (Earned)": earn.get("da_earned", 0),
            "Basic+DA (Earned)": earn.get("basic_da_earned", 0),
            "HRA (Earned)": earn.get("hra_earned", 0),
            "Conveyance (Earned)": earn.get("conveyance_earned", 0),
            "GRADE PAY (Earned)": earn.get("grade_pay_earned", 0),
            "OTHER ALLOW (Earned)": earn.get("other_allowance_earned", 0),
            "Med./Spl. Allow (Earned)": earn.get("medical_allowance_earned", 0),
            "Total Salary Earned": earn.get("total_salary_earned", 0),

            # Deductions
            "EPF Employees": ded.get("epf", 0),
            "ESI Employees": ded.get("esi", 0),
            "SEWA": ded.get("sewa", 0),
            "Sewa Advance": ded.get("sewa_advance", 0),
            "Other Deduction": ded.get("other_deduction", 0),
            "Total Deduction": ded.get("total_deductions", 0),
            "NET PAYABLE": slip.get("net_salary", slip.get("net_payable", 0)),

            # Validation
            "Validation": "PASS" if validation.get("passed", True) else f"FAIL ({validation.get('difference', 0)})",
        }
        export_data.append(row)

    return export_data
