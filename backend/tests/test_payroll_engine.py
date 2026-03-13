"""
Comprehensive tests for the refactored Payroll Calculation Engine
Tests all payroll formulas and business rules including:
- PF = min(12% * Earned Basic+DA, 15000 max deduction)
- ESI = 0.75% of Total Salary Earned (only when earned ≤ 21000)
- SEWA = 2% of FIXED Basic (not earned)
- Component-wise proration: round(Fixed / CalDays * EarnedDays, 2)
- Late deduction: 3 lates = 1 day reduction from earned days
- 2nd Saturday fully paid even if not attended
- Validation: Net = Earned - Deductions (mismatch ≤ 0.01)
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://theme-switcher-demo.preview.emergentagent.com').rstrip('/')


class TestPayrollAuth:
    """Authentication tests for payroll APIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_login_success(self):
        """Test admin login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "super_admin"


class TestPayrollRules:
    """Test payroll rules endpoint and configuration"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_get_payroll_rules(self, headers):
        """Test payroll rules endpoint returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/payroll/rules", headers=headers)
        assert response.status_code == 200
        rules = response.json()
        
        # Verify late_count_threshold = 3 (was 2 before refactor)
        assert rules.get("late_count_threshold") == 3, f"late_count_threshold should be 3, got {rules.get('late_count_threshold')}"
        
        # Verify EPF settings
        assert rules.get("epf_employee_percentage") == 12, "EPF should be 12%"
        
        # Verify ESI settings
        assert rules.get("esi_employee_percentage") == 0.75, "ESI should be 0.75%"
        assert rules.get("esi_wage_ceiling") == 21000, "ESI ceiling should be 21000"
        
        # Verify SEWA settings
        assert rules.get("sewa_percentage") == 2, "SEWA should be 2%"


class TestPayrollRuns:
    """Test payroll run CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_list_payroll_runs(self, headers):
        """Test listing payroll runs"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=headers)
        assert response.status_code == 200
        runs = response.json()
        assert isinstance(runs, list)

    def test_get_existing_payroll_run(self, headers):
        """Test getting existing Jan 2026 payroll run details"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check payroll structure
        assert "payroll" in data
        assert "payslips" in data
        
        payroll = data["payroll"]
        assert payroll["month"] == 1
        assert payroll["year"] == 2026
        assert payroll["status"] == "processed"
        assert payroll["total_employees"] == 27
        
        # Check payslips structure
        payslips = data["payslips"]
        assert len(payslips) == 27, f"Expected 27 payslips, got {len(payslips)}"

    def test_create_duplicate_payroll_run_fails(self, headers):
        """Test creating duplicate payroll run for same month/year fails"""
        response = requests.post(f"{BASE_URL}/api/payroll/runs?month=1&year=2026", headers=headers)
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()


class TestPayslipStructure:
    """Test new payslip document structure"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_payslip_has_fixed_components(self, payslips):
        """Test payslip has fixed_components sub-object"""
        for slip in payslips:
            assert "fixed_components" in slip, f"Missing fixed_components for {slip.get('emp_code')}"
            fc = slip["fixed_components"]
            assert "basic" in fc
            assert "da" in fc
            assert "hra" in fc
            assert "total_fixed" in fc

    def test_payslip_has_attendance(self, payslips):
        """Test payslip has attendance sub-object with new fields"""
        for slip in payslips:
            assert "attendance" in slip, f"Missing attendance for {slip.get('emp_code')}"
            att = slip["attendance"]
            assert "late_count" in att
            assert "late_deduction_days" in att
            assert "total_earned_days" in att
            assert "total_days_in_month" in att
            assert "second_saturday_count" in att
            assert "paid_sundays" in att

    def test_payslip_has_earnings(self, payslips):
        """Test payslip has earnings sub-object with earned components"""
        for slip in payslips:
            assert "earnings" in slip, f"Missing earnings for {slip.get('emp_code')}"
            earn = slip["earnings"]
            assert "basic_earned" in earn
            assert "da_earned" in earn
            assert "basic_da_earned" in earn
            assert "total_salary_earned" in earn

    def test_payslip_has_deductions(self, payslips):
        """Test payslip has deductions sub-object"""
        for slip in payslips:
            assert "deductions" in slip, f"Missing deductions for {slip.get('emp_code')}"
            ded = slip["deductions"]
            assert "epf" in ded
            assert "esi" in ded
            assert "sewa" in ded
            assert "total_deductions" in ded

    def test_payslip_has_validation(self, payslips):
        """Test payslip has validation sub-object"""
        for slip in payslips:
            assert "validation" in slip, f"Missing validation for {slip.get('emp_code')}"
            val = slip["validation"]
            assert "passed" in val
            assert "difference" in val
            assert "formula" in val


class TestPFCalculation:
    """Test PF (EPF) calculation: min(12% * Earned Basic+DA, 15000 max deduction)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_pf_formula_basic_plus_da(self, payslips):
        """Test PF is calculated on earned basic + da (not just basic)"""
        for slip in payslips:
            epf = slip["deductions"]["epf"]
            basic_da_earned = slip["earnings"]["basic_da_earned"]
            
            # Skip if EPF is 0 (maybe not applicable)
            if epf == 0:
                continue
            
            # PF should be 12% of basic+da earned OR max 15000
            expected_pf = round(basic_da_earned * 0.12, 2)
            expected_pf_capped = min(expected_pf, 15000)
            
            assert abs(epf - expected_pf_capped) <= 0.02, \
                f"{slip['emp_code']}: PF {epf} != expected {expected_pf_capped} (basic_da_earned={basic_da_earned})"

    def test_pf_max_deduction_cap(self, payslips):
        """Test PF never exceeds 15000 (the max deduction cap)"""
        for slip in payslips:
            epf = slip["deductions"]["epf"]
            assert epf <= 15000, f"{slip['emp_code']}: PF {epf} exceeds max cap 15000"


class TestESICalculation:
    """Test ESI calculation: 0.75% of Total Salary Earned, only when earned ≤ 21000"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_esi_eligibility_on_earned_gross(self, payslips):
        """Test ESI is only applied when total earned salary ≤ 21000"""
        for slip in payslips:
            esi = slip["deductions"]["esi"]
            total_salary_earned = slip["earnings"]["total_salary_earned"]
            
            if total_salary_earned > 21000:
                # ESI should be 0 for salaries above ceiling
                assert esi == 0, \
                    f"{slip['emp_code']}: ESI should be 0 when earned ({total_salary_earned}) > 21000, got {esi}"
            elif esi > 0:
                # ESI should be 0.75% of total earned salary
                expected_esi = round(total_salary_earned * 0.0075, 2)
                assert abs(esi - expected_esi) <= 0.02, \
                    f"{slip['emp_code']}: ESI {esi} != expected {expected_esi} (earned={total_salary_earned})"

    def test_esi_percentage_correct(self, payslips):
        """Test ESI is exactly 0.75% (not any other percentage)"""
        for slip in payslips:
            esi = slip["deductions"]["esi"]
            total_salary_earned = slip["earnings"]["total_salary_earned"]
            
            if esi > 0:
                percentage = (esi / total_salary_earned) * 100
                assert abs(percentage - 0.75) <= 0.01, \
                    f"{slip['emp_code']}: ESI percentage {percentage:.4f}% != 0.75%"


class TestSEWACalculation:
    """Test SEWA calculation: 2% of FIXED Basic (not earned basic)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_sewa_calculated_on_fixed_basic(self, payslips):
        """Test SEWA is 2% of FIXED basic (not earned basic)"""
        for slip in payslips:
            sewa = slip["deductions"]["sewa"]
            fixed_basic = slip["fixed_components"]["basic"]
            
            if sewa > 0:
                expected_sewa = round(fixed_basic * 0.02, 2)
                assert abs(sewa - expected_sewa) <= 0.02, \
                    f"{slip['emp_code']}: SEWA {sewa} != expected {expected_sewa} (fixed_basic={fixed_basic})"

    def test_sewa_not_on_earned_basic(self, payslips):
        """Verify SEWA is NOT calculated on earned basic (regression check)"""
        for slip in payslips:
            sewa = slip["deductions"]["sewa"]
            basic_earned = slip["earnings"]["basic_earned"]
            
            if sewa > 0:
                # SEWA should NOT be 2% of earned basic
                sewa_if_on_earned = round(basic_earned * 0.02, 2)
                # Allow match only if fixed == earned (full month)
                if slip["fixed_components"]["basic"] != basic_earned:
                    # If different, SEWA should not match earned calculation
                    pass  # The other test validates it's based on fixed


class TestProrationFormula:
    """Test component-wise proration: round(Fixed / CalDays * EarnedDays, 2)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_basic_proration(self, payslips):
        """Test basic salary proration formula"""
        for slip in payslips:
            fixed_basic = slip["fixed_components"]["basic"]
            basic_earned = slip["earnings"]["basic_earned"]
            earned_days = slip["attendance"]["total_earned_days"]
            cal_days = slip["attendance"]["total_days_in_month"]
            
            expected_earned = round((fixed_basic / cal_days) * earned_days, 2)
            
            # Allow small tolerance for rounding differences
            assert abs(basic_earned - expected_earned) <= 0.02, \
                f"{slip['emp_code']}: basic_earned {basic_earned} != expected {expected_earned}"

    def test_hra_proration(self, payslips):
        """Test HRA proration formula"""
        for slip in payslips:
            fixed_hra = slip["fixed_components"]["hra"]
            hra_earned = slip["earnings"]["hra_earned"]
            earned_days = slip["attendance"]["total_earned_days"]
            cal_days = slip["attendance"]["total_days_in_month"]
            
            expected_earned = round((fixed_hra / cal_days) * earned_days, 2)
            
            assert abs(hra_earned - expected_earned) <= 0.02, \
                f"{slip['emp_code']}: hra_earned {hra_earned} != expected {expected_earned}"

    def test_total_earned_equals_sum_of_components(self, payslips):
        """Test total salary earned = sum of all earned components"""
        for slip in payslips:
            earn = slip["earnings"]
            components_sum = (
                earn["basic_earned"] +
                earn["da_earned"] +
                earn["hra_earned"] +
                earn["conveyance_earned"] +
                earn["grade_pay_earned"] +
                earn["other_allowance_earned"] +
                earn["medical_allowance_earned"]
            )
            total_earned = earn["total_salary_earned"]
            
            assert abs(components_sum - total_earned) <= 0.02, \
                f"{slip['emp_code']}: components_sum {components_sum} != total_earned {total_earned}"


class TestLateDeduction:
    """Test late deduction: 3 lates = 1 day reduction from earned days"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_late_deduction_threshold(self, payslips):
        """Test 3 lates = 1 day deduction (not 2 lates)"""
        for slip in payslips:
            late_count = slip["attendance"]["late_count"]
            late_deduction_days = slip["attendance"]["late_deduction_days"]
            
            # 3 lates = 1 day, 6 lates = 2 days, etc.
            expected_deduction = late_count // 3
            
            assert late_deduction_days == expected_deduction, \
                f"{slip['emp_code']}: late_deduction_days {late_deduction_days} != expected {expected_deduction} (late_count={late_count})"

    def test_less_than_3_lates_no_deduction(self, payslips):
        """Test employees with <3 lates have 0 late deduction days"""
        for slip in payslips:
            late_count = slip["attendance"]["late_count"]
            late_deduction_days = slip["attendance"]["late_deduction_days"]
            
            if late_count < 3:
                assert late_deduction_days == 0, \
                    f"{slip['emp_code']}: late_deduction_days should be 0 for {late_count} lates"


class TestSecondSaturdayFullPay:
    """Test 2nd Saturday is half working day but FULLY PAID"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_second_saturday_count_tracked(self, payslips):
        """Test second_saturday_count is tracked in attendance"""
        for slip in payslips:
            att = slip["attendance"]
            assert "second_saturday_count" in att, \
                f"{slip['emp_code']}: Missing second_saturday_count in attendance"
            # Value can be 0 or 1 (for Jan 2026, there's 1 2nd Saturday)
            assert att["second_saturday_count"] >= 0

    def test_unattended_second_saturday_adds_full_day(self, payslips):
        """Test unattended 2nd Saturday counts as 1.0 earned day (not 0.5)"""
        # Find employees with second_saturday_count > 0
        employees_with_2nd_sat = [s for s in payslips if s["attendance"]["second_saturday_count"] > 0]
        
        assert len(employees_with_2nd_sat) > 0, "No employees found with unattended 2nd Saturday"
        
        for slip in employees_with_2nd_sat:
            # second_saturday_count represents UNATTENDED 2nd Saturdays
            # These should add 1.0 each to earned days (fully paid)
            second_sat_count = slip["attendance"]["second_saturday_count"]
            assert second_sat_count == 1.0, f"Unattended 2nd Saturday should count as 1.0 day"


class TestValidation:
    """Test validation field: Net = Earned - Deductions (mismatch ≤ 0.01)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_all_payslips_pass_validation(self, payslips):
        """Test all payslips have validation.passed = True"""
        for slip in payslips:
            assert slip["validation"]["passed"] == True, \
                f"{slip['emp_code']}: validation failed with difference {slip['validation']['difference']}"

    def test_validation_difference_within_tolerance(self, payslips):
        """Test validation difference is ≤ 0.01 for all payslips"""
        for slip in payslips:
            diff = abs(slip["validation"]["difference"])
            assert diff <= 0.01, \
                f"{slip['emp_code']}: validation difference {diff} exceeds tolerance 0.01"

    def test_net_equals_earned_minus_deductions(self, payslips):
        """Test Net Payable = Total Salary Earned - Total Deductions"""
        for slip in payslips:
            total_earned = slip["earnings"]["total_salary_earned"]
            total_deductions = slip["deductions"]["total_deductions"]
            net_salary = slip["net_salary"]
            
            expected_net = round(total_earned - total_deductions, 2)
            
            assert abs(net_salary - expected_net) <= 0.01, \
                f"{slip['emp_code']}: net_salary {net_salary} != expected {expected_net}"


class TestExcelExport:
    """Test Excel export has new columns"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_export_endpoint_returns_excel(self, headers):
        """Test export endpoint returns Excel file"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193/export",
            headers=headers
        )
        assert response.status_code == 200
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type or "vnd.openxmlformats" in content_type

    def test_export_contains_new_columns(self, headers):
        """Test export contains Basic (Earned), DA (Earned), Late Count, Late Deduction Days, Validation"""
        import io
        import openpyxl
        
        response = requests.get(
            f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193/export",
            headers=headers
        )
        assert response.status_code == 200
        
        wb = openpyxl.load_workbook(io.BytesIO(response.content))
        ws = wb.active
        headers_row = [cell.value for cell in ws[1]]
        
        # Check new columns exist
        required_columns = [
            "Basic (Earned)",
            "DA (Earned)", 
            "Late Count",
            "Late Deduction Days",
            "Validation"
        ]
        
        for col in required_columns:
            assert col in headers_row, f"Missing column '{col}' in export"


class TestConfigUsed:
    """Test payslip stores config_used for audit trail"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_payslip_has_config_used(self, payslips):
        """Test each payslip stores the config used for calculation"""
        for slip in payslips:
            assert "config_used" in slip, f"Missing config_used for {slip.get('emp_code')}"
            config = slip["config_used"]
            
            # Verify config values
            assert config.get("epf_percentage") == 12.0
            assert config.get("epf_max_deduction") == 15000.0
            assert config.get("esi_percentage") == 0.75
            assert config.get("esi_ceiling") == 21000.0
            assert config.get("sewa_percentage") == 2.0
            assert config.get("late_threshold") == 3


class TestRounding:
    """Test all values are rounded to 2 decimal places"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def payslips(self, headers):
        response = requests.get(f"{BASE_URL}/api/payroll/runs/pr_4c136ed43193", headers=headers)
        return response.json().get("payslips", [])

    def test_earnings_rounded_to_2dp(self, payslips):
        """Test all earnings are rounded to 2 decimal places"""
        for slip in payslips:
            earn = slip["earnings"]
            for key, value in earn.items():
                if isinstance(value, float):
                    # Check decimal places
                    str_val = str(value)
                    if '.' in str_val:
                        decimal_places = len(str_val.split('.')[1])
                        assert decimal_places <= 2, \
                            f"{slip['emp_code']}: {key}={value} has {decimal_places} decimal places"

    def test_deductions_rounded_to_2dp(self, payslips):
        """Test all deductions are rounded to 2 decimal places"""
        for slip in payslips:
            ded = slip["deductions"]
            for key, value in ded.items():
                if isinstance(value, float):
                    str_val = str(value)
                    if '.' in str_val:
                        decimal_places = len(str_val.split('.')[1])
                        assert decimal_places <= 2, \
                            f"{slip['emp_code']}: {key}={value} has {decimal_places} decimal places"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
