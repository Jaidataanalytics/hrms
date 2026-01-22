"""
Test Payroll Details API - GET /api/payroll/runs/{payroll_id}
Tests the ability to view processed payroll with all employee payslips
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://payformulas.preview.emergentagent.com')

class TestPayrollDetails:
    """Test payroll details endpoint for viewing processed payroll with payslips"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json()
        print(f"✓ Logged in as: {self.user.get('email')} (role: {self.user.get('role')})")
    
    def test_list_payroll_runs(self):
        """Test GET /api/payroll/runs - List all payroll runs"""
        response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200, f"Failed to list payroll runs: {response.text}"
        
        runs = response.json()
        assert isinstance(runs, list), "Response should be a list"
        print(f"✓ Found {len(runs)} payroll runs")
        
        # Check if we have processed payroll runs
        processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
        print(f"✓ Found {len(processed_runs)} processed/locked payroll runs")
        
        return runs
    
    def test_get_payroll_details_for_january_2026(self):
        """Test GET /api/payroll/runs/{payroll_id} - Get payroll details with payslips"""
        # First get the list of payroll runs
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        assert runs_response.status_code == 200
        runs = runs_response.json()
        
        # Find January 2026 payroll (as mentioned in context)
        jan_2026_run = None
        for run in runs:
            if run.get('month') == 1 and run.get('year') == 2026:
                jan_2026_run = run
                break
        
        if not jan_2026_run:
            # Try to find any processed payroll
            processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
            if processed_runs:
                jan_2026_run = processed_runs[0]
                print(f"✓ Using payroll run: {jan_2026_run.get('month')}/{jan_2026_run.get('year')}")
        
        assert jan_2026_run is not None, "No processed payroll run found"
        
        payroll_id = jan_2026_run.get('payroll_id')
        print(f"✓ Testing payroll ID: {payroll_id}")
        
        # Get payroll details
        response = self.session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
        assert response.status_code == 200, f"Failed to get payroll details: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert 'payroll' in data, "Response should contain 'payroll' key"
        assert 'payslips' in data, "Response should contain 'payslips' key"
        assert 'summary' in data, "Response should contain 'summary' key"
        
        print(f"✓ Response has correct structure: payroll, payslips, summary")
        
        return data
    
    def test_payroll_details_has_summary(self):
        """Test that payroll details include summary with totals"""
        # Get a processed payroll
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        runs = runs_response.json()
        processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
        
        if not processed_runs:
            pytest.skip("No processed payroll runs available")
        
        payroll_id = processed_runs[0].get('payroll_id')
        response = self.session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
        data = response.json()
        
        summary = data.get('summary', {})
        
        # Verify summary fields
        assert 'total_employees' in summary, "Summary should have total_employees"
        assert 'total_gross' in summary, "Summary should have total_gross"
        assert 'total_deductions' in summary, "Summary should have total_deductions"
        assert 'total_net' in summary, "Summary should have total_net"
        assert 'total_pf' in summary, "Summary should have total_pf"
        assert 'total_esi' in summary, "Summary should have total_esi"
        assert 'total_pt' in summary, "Summary should have total_pt"
        
        print(f"✓ Summary has all required fields")
        print(f"  - Total Employees: {summary.get('total_employees')}")
        print(f"  - Total Gross: ₹{summary.get('total_gross'):,.0f}")
        print(f"  - Total Deductions: ₹{summary.get('total_deductions'):,.0f}")
        print(f"  - Total Net: ₹{summary.get('total_net'):,.0f}")
        print(f"  - Total PF: ₹{summary.get('total_pf'):,.0f}")
        print(f"  - Total ESI: ₹{summary.get('total_esi'):,.0f}")
        print(f"  - Total PT: ₹{summary.get('total_pt'):,.0f}")
    
    def test_payroll_details_has_payslips_with_employee_info(self):
        """Test that payslips include employee details (name, code, department)"""
        # Get a processed payroll
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        runs = runs_response.json()
        processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
        
        if not processed_runs:
            pytest.skip("No processed payroll runs available")
        
        payroll_id = processed_runs[0].get('payroll_id')
        response = self.session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
        data = response.json()
        
        payslips = data.get('payslips', [])
        assert len(payslips) > 0, "Should have at least one payslip"
        
        print(f"✓ Found {len(payslips)} payslips")
        
        # Check first payslip structure
        first_slip = payslips[0]
        
        # Required fields for display
        required_fields = [
            'employee_id', 'employee_name', 'emp_code', 'department',
            'working_days', 'paid_days', 'gross_salary', 'total_deductions', 'net_salary'
        ]
        
        for field in required_fields:
            assert field in first_slip, f"Payslip should have '{field}' field"
        
        print(f"✓ Payslips have all required fields for display")
        print(f"  Sample payslip:")
        print(f"  - Employee: {first_slip.get('employee_name')} ({first_slip.get('emp_code')})")
        print(f"  - Department: {first_slip.get('department')}")
        print(f"  - Days: {first_slip.get('paid_days')}/{first_slip.get('working_days')}")
        print(f"  - Gross: ₹{first_slip.get('gross_salary'):,.0f}")
        print(f"  - Deductions: ₹{first_slip.get('total_deductions'):,.0f}")
        print(f"  - Net: ₹{first_slip.get('net_salary'):,.0f}")
    
    def test_payroll_details_not_found(self):
        """Test GET /api/payroll/runs/{invalid_id} returns 404"""
        response = self.session.get(f"{BASE_URL}/api/payroll/runs/invalid_payroll_id_123")
        assert response.status_code == 404, f"Expected 404 for invalid payroll ID, got {response.status_code}"
        print(f"✓ Returns 404 for invalid payroll ID")
    
    def test_payroll_details_requires_auth(self):
        """Test that payroll details endpoint requires authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        
        # Get a valid payroll ID first
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        runs = runs_response.json()
        
        if runs:
            payroll_id = runs[0].get('payroll_id')
            response = unauth_session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
            assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
            print(f"✓ Endpoint requires authentication (returns {response.status_code})")
    
    def test_payroll_details_requires_hr_role(self):
        """Test that only HR/Admin/Finance can access payroll details"""
        # Login as employee (if available)
        employee_session = requests.Session()
        employee_session.headers.update({"Content-Type": "application/json"})
        
        login_response = employee_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "employee@shardahr.com", "password": "Employee@123"}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Employee test user not available")
        
        # Get a valid payroll ID
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        runs = runs_response.json()
        
        if runs:
            payroll_id = runs[0].get('payroll_id')
            response = employee_session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
            assert response.status_code == 403, f"Expected 403 for employee role, got {response.status_code}"
            print(f"✓ Endpoint restricts access to HR/Admin/Finance roles")


class TestPayrollRunsTab:
    """Test payroll runs listing for the Payroll Runs tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200
        self.user = login_response.json()
    
    def test_payroll_runs_show_view_button_for_processed(self):
        """Test that processed payroll runs have data for View button"""
        response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200
        
        runs = response.json()
        processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
        
        if not processed_runs:
            pytest.skip("No processed payroll runs available")
        
        for run in processed_runs:
            assert 'payroll_id' in run, "Run should have payroll_id for View button"
            assert 'status' in run, "Run should have status"
            assert run['status'] in ['processed', 'locked'], "Status should be processed or locked"
            
        print(f"✓ {len(processed_runs)} processed runs have payroll_id for View button")
    
    def test_payroll_run_has_summary_data(self):
        """Test that payroll runs have summary data (employees, gross, net)"""
        response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        runs = response.json()
        
        processed_runs = [r for r in runs if r.get('status') in ['processed', 'locked']]
        
        if not processed_runs:
            pytest.skip("No processed payroll runs available")
        
        run = processed_runs[0]
        
        # Check summary fields in run listing
        assert 'total_employees' in run, "Run should have total_employees"
        assert 'total_gross' in run, "Run should have total_gross"
        assert 'total_net' in run, "Run should have total_net"
        
        print(f"✓ Payroll run has summary data:")
        print(f"  - Period: {run.get('month')}/{run.get('year')}")
        print(f"  - Employees: {run.get('total_employees')}")
        print(f"  - Gross: ₹{run.get('total_gross'):,.0f}")
        print(f"  - Net: ₹{run.get('total_net'):,.0f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
