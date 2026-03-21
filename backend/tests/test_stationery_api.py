"""
Stationery Inventory Management API Tests
Tests: Categories, Items CRUD, Purchase, Issue, Return, Transactions, Requests
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://employee-mis-tools.preview.emergentagent.com').rstrip('/')

class TestStationeryAPI:
    """Stationery Inventory Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        
        # Token is 'access_token' not 'token'
        self.token = login_data.get("access_token")
        assert self.token, "No access_token in login response"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_item_id = None
        self.created_request_id = None
        yield
        
        # Cleanup: Delete test items
        if self.created_item_id:
            try:
                self.session.delete(f"{BASE_URL}/api/stationery/items/{self.created_item_id}")
            except:
                pass

    # ==================== CATEGORIES ====================
    def test_get_categories(self):
        """GET /api/stationery/categories returns categories and units"""
        response = self.session.get(f"{BASE_URL}/api/stationery/categories")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "categories" in data, "Response missing 'categories'"
        assert "units" in data, "Response missing 'units'"
        assert len(data["categories"]) > 0, "Categories list is empty"
        assert len(data["units"]) > 0, "Units list is empty"
        
        # Verify expected categories
        expected_cats = ["Pens", "Pencils", "Notebooks", "Paper/Reams", "Folders"]
        for cat in expected_cats:
            assert cat in data["categories"], f"Missing category: {cat}"
        
        # Verify expected units
        expected_units = ["pieces", "packs", "reams", "boxes"]
        for unit in expected_units:
            assert unit in data["units"], f"Missing unit: {unit}"
        
        print(f"PASS: Categories ({len(data['categories'])}) and Units ({len(data['units'])}) returned")

    # ==================== ITEMS CRUD ====================
    def test_create_item(self):
        """POST /api/stationery/items creates a new stationery item with opening stock"""
        item_data = {
            "name": "TEST_Red Gel Pen",
            "category": "Pens",
            "unit": "pieces",
            "purchase_price": 15.50,
            "opening_stock": 50,
            "min_stock_level": 10
        }
        
        response = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        data = response.json()
        
        assert "item_id" in data, "Response missing 'item_id'"
        assert data["name"] == item_data["name"], "Name mismatch"
        assert data["category"] == item_data["category"], "Category mismatch"
        assert data["current_stock"] == item_data["opening_stock"], "Opening stock not set"
        assert data["purchase_price"] == item_data["purchase_price"], "Price mismatch"
        
        self.created_item_id = data["item_id"]
        print(f"PASS: Created item {self.created_item_id} with opening stock {data['current_stock']}")
        return data["item_id"]

    def test_list_items_with_stats(self):
        """GET /api/stationery/items returns items with stats"""
        response = self.session.get(f"{BASE_URL}/api/stationery/items")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "items" in data, "Response missing 'items'"
        assert "total_items" in data, "Response missing 'total_items'"
        assert "total_value" in data, "Response missing 'total_value'"
        assert "low_stock_count" in data, "Response missing 'low_stock_count'"
        
        assert isinstance(data["items"], list), "items should be a list"
        assert isinstance(data["total_items"], int), "total_items should be int"
        assert isinstance(data["total_value"], (int, float)), "total_value should be numeric"
        
        print(f"PASS: Items list returned with stats - total: {data['total_items']}, value: {data['total_value']}, low_stock: {data['low_stock_count']}")

    def test_update_item(self):
        """PUT /api/stationery/items/{item_id} updates an item"""
        # First create an item
        item_data = {
            "name": "TEST_Update Item",
            "category": "Pencils",
            "unit": "boxes",
            "purchase_price": 25.00,
            "opening_stock": 20,
            "min_stock_level": 5
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200, f"Failed to create: {create_resp.text}"
        item_id = create_resp.json()["item_id"]
        self.created_item_id = item_id
        
        # Update the item
        update_data = {
            "name": "TEST_Updated Item Name",
            "purchase_price": 30.00,
            "min_stock_level": 8
        }
        update_resp = self.session.put(f"{BASE_URL}/api/stationery/items/{item_id}", json=update_data)
        assert update_resp.status_code == 200, f"Failed to update: {update_resp.text}"
        
        # Verify update via GET
        get_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        items = get_resp.json()["items"]
        updated_item = next((i for i in items if i["item_id"] == item_id), None)
        
        assert updated_item is not None, "Updated item not found"
        assert updated_item["name"] == update_data["name"], "Name not updated"
        assert updated_item["purchase_price"] == update_data["purchase_price"], "Price not updated"
        
        print(f"PASS: Item {item_id} updated successfully")

    def test_delete_item(self):
        """DELETE /api/stationery/items/{item_id} soft-deletes an item"""
        # Create item to delete
        item_data = {
            "name": "TEST_Delete Item",
            "category": "Markers",
            "unit": "pieces",
            "purchase_price": 10.00,
            "opening_stock": 5
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["item_id"]
        
        # Delete the item
        delete_resp = self.session.delete(f"{BASE_URL}/api/stationery/items/{item_id}")
        assert delete_resp.status_code == 200, f"Failed to delete: {delete_resp.text}"
        
        # Verify item is no longer in active list
        get_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        items = get_resp.json()["items"]
        deleted_item = next((i for i in items if i["item_id"] == item_id), None)
        
        assert deleted_item is None, "Deleted item still appears in list"
        print(f"PASS: Item {item_id} soft-deleted successfully")

    # ==================== PURCHASE (STOCK-IN) ====================
    def test_purchase_stock(self):
        """POST /api/stationery/purchase adds stock and creates a purchase transaction"""
        # Create item first
        item_data = {
            "name": "TEST_Purchase Item",
            "category": "Notebooks",
            "unit": "pieces",
            "purchase_price": 50.00,
            "opening_stock": 10,
            "min_stock_level": 5
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["item_id"]
        self.created_item_id = item_id
        initial_stock = create_resp.json()["current_stock"]
        
        # Purchase more stock
        purchase_data = {
            "item_id": item_id,
            "qty": 25,
            "price_per_unit": 48.00,
            "vendor": "Test Vendor",
            "notes": "Test purchase"
        }
        purchase_resp = self.session.post(f"{BASE_URL}/api/stationery/purchase", json=purchase_data)
        assert purchase_resp.status_code == 200, f"Failed to purchase: {purchase_resp.text}"
        data = purchase_resp.json()
        
        assert "new_stock" in data, "Response missing 'new_stock'"
        assert data["new_stock"] == initial_stock + purchase_data["qty"], f"Stock not updated correctly. Expected {initial_stock + purchase_data['qty']}, got {data['new_stock']}"
        
        print(f"PASS: Purchased {purchase_data['qty']} units, new stock: {data['new_stock']}")

    # ==================== ISSUE (STOCK-OUT) ====================
    def test_issue_item(self):
        """POST /api/stationery/issue deducts stock"""
        # Create item with sufficient stock
        item_data = {
            "name": "TEST_Issue Item",
            "category": "Pens",
            "unit": "pieces",
            "purchase_price": 10.00,
            "opening_stock": 100,
            "min_stock_level": 10
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["item_id"]
        self.created_item_id = item_id
        initial_stock = create_resp.json()["current_stock"]
        
        # Get an employee to issue to
        emp_resp = self.session.get(f"{BASE_URL}/api/stationery/employees")
        if emp_resp.status_code == 200 and len(emp_resp.json()) > 0:
            employee_id = emp_resp.json()[0]["employee_id"]
        else:
            employee_id = "EMP001"  # Fallback
        
        # Issue items
        issue_data = {
            "item_id": item_id,
            "qty": 5,
            "employee_id": employee_id,
            "notes": "Test issue"
        }
        issue_resp = self.session.post(f"{BASE_URL}/api/stationery/issue", json=issue_data)
        assert issue_resp.status_code == 200, f"Failed to issue: {issue_resp.text}"
        data = issue_resp.json()
        
        assert "new_stock" in data, "Response missing 'new_stock'"
        assert data["new_stock"] == initial_stock - issue_data["qty"], f"Stock not deducted correctly"
        
        print(f"PASS: Issued {issue_data['qty']} units, new stock: {data['new_stock']}")

    def test_issue_insufficient_stock(self):
        """POST /api/stationery/issue rejects if insufficient stock"""
        # Create item with low stock
        item_data = {
            "name": "TEST_Low Stock Item",
            "category": "Tape",
            "unit": "rolls",
            "purchase_price": 30.00,
            "opening_stock": 3,
            "min_stock_level": 5
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["item_id"]
        self.created_item_id = item_id
        
        # Try to issue more than available
        issue_data = {
            "item_id": item_id,
            "qty": 10,  # More than available (3)
            "employee_id": "EMP001",
            "notes": "Test insufficient"
        }
        issue_resp = self.session.post(f"{BASE_URL}/api/stationery/issue", json=issue_data)
        assert issue_resp.status_code == 400, f"Should reject insufficient stock, got {issue_resp.status_code}"
        
        error_data = issue_resp.json()
        assert "Insufficient stock" in error_data.get("detail", ""), "Error message should mention insufficient stock"
        
        print(f"PASS: Correctly rejected issue due to insufficient stock")

    # ==================== RETURN ====================
    def test_return_item(self):
        """POST /api/stationery/return adds returned stock back"""
        # Create item
        item_data = {
            "name": "TEST_Return Item",
            "category": "Scissors",
            "unit": "pieces",
            "purchase_price": 80.00,
            "opening_stock": 20,
            "min_stock_level": 5
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200
        item_id = create_resp.json()["item_id"]
        self.created_item_id = item_id
        
        # Issue some items first
        issue_data = {"item_id": item_id, "qty": 5, "employee_id": "EMP001"}
        self.session.post(f"{BASE_URL}/api/stationery/issue", json=issue_data)
        
        # Get current stock
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        item = next((i for i in items_resp.json()["items"] if i["item_id"] == item_id), None)
        stock_before_return = item["current_stock"]
        
        # Return items
        return_data = {
            "item_id": item_id,
            "qty": 3,
            "employee_name": "Test Employee",
            "notes": "Returned scissors"
        }
        return_resp = self.session.post(f"{BASE_URL}/api/stationery/return", json=return_data)
        assert return_resp.status_code == 200, f"Failed to return: {return_resp.text}"
        data = return_resp.json()
        
        assert "new_stock" in data, "Response missing 'new_stock'"
        assert data["new_stock"] == stock_before_return + return_data["qty"], "Stock not restored correctly"
        
        print(f"PASS: Returned {return_data['qty']} units, new stock: {data['new_stock']}")

    # ==================== TRANSACTIONS ====================
    def test_get_transactions(self):
        """GET /api/stationery/transactions returns history"""
        response = self.session.get(f"{BASE_URL}/api/stationery/transactions")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Transactions should be a list"
        
        if len(data) > 0:
            txn = data[0]
            assert "txn_id" in txn, "Transaction missing 'txn_id'"
            assert "type" in txn, "Transaction missing 'type'"
            assert "item_name" in txn, "Transaction missing 'item_name'"
            assert "qty" in txn, "Transaction missing 'qty'"
            assert txn["type"] in ["purchase", "issue", "return"], f"Invalid type: {txn['type']}"
        
        print(f"PASS: Transactions list returned ({len(data)} records)")

    def test_get_transactions_filtered(self):
        """GET /api/stationery/transactions with type filter"""
        # Test purchase filter
        response = self.session.get(f"{BASE_URL}/api/stationery/transactions?type=purchase")
        assert response.status_code == 200
        data = response.json()
        
        for txn in data:
            assert txn["type"] == "purchase", f"Filter not working, got type: {txn['type']}"
        
        print(f"PASS: Transactions filtered by type=purchase ({len(data)} records)")

    # ==================== REQUESTS ====================
    def test_create_request(self):
        """POST /api/stationery/requests creates employee stationery request"""
        # Get an existing item
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        items = items_resp.json()["items"]
        
        if len(items) == 0:
            pytest.skip("No items available to request")
        
        item = items[0]
        
        request_data = {
            "items": [
                {"item_id": item["item_id"], "item_name": item["name"], "qty": 2}
            ],
            "notes": "Test request for stationery"
        }
        
        response = self.session.post(f"{BASE_URL}/api/stationery/requests", json=request_data)
        assert response.status_code == 200, f"Failed to create request: {response.text}"
        data = response.json()
        
        assert "request_id" in data, "Response missing 'request_id'"
        assert data["status"] == "pending", "New request should be pending"
        assert len(data["items"]) > 0, "Request should have items"
        
        self.created_request_id = data["request_id"]
        print(f"PASS: Created request {self.created_request_id}")
        return data["request_id"]

    def test_list_requests(self):
        """GET /api/stationery/requests returns requests list"""
        response = self.session.get(f"{BASE_URL}/api/stationery/requests")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Requests should be a list"
        
        if len(data) > 0:
            req = data[0]
            assert "request_id" in req, "Request missing 'request_id'"
            assert "status" in req, "Request missing 'status'"
            assert "items" in req, "Request missing 'items'"
        
        print(f"PASS: Requests list returned ({len(data)} records)")

    def test_approve_request(self):
        """PUT /api/stationery/requests/{id}/approve approves and auto-issues items"""
        # Create a request first
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        items = items_resp.json()["items"]
        
        if len(items) == 0:
            pytest.skip("No items available")
        
        # Find item with stock
        item = next((i for i in items if i["current_stock"] > 5), items[0])
        
        request_data = {
            "items": [{"item_id": item["item_id"], "item_name": item["name"], "qty": 2}],
            "notes": "Test approve request"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/requests", json=request_data)
        assert create_resp.status_code == 200
        request_id = create_resp.json()["request_id"]
        
        # Approve the request
        approve_resp = self.session.put(f"{BASE_URL}/api/stationery/requests/{request_id}/approve")
        assert approve_resp.status_code == 200, f"Failed to approve: {approve_resp.text}"
        data = approve_resp.json()
        
        assert "issued" in data, "Response should contain 'issued' items"
        print(f"PASS: Request {request_id} approved, issued: {data.get('issued', [])}")

    def test_reject_request(self):
        """PUT /api/stationery/requests/{id}/reject rejects request"""
        # Create a request first
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        items = items_resp.json()["items"]
        
        if len(items) == 0:
            pytest.skip("No items available")
        
        item = items[0]
        
        request_data = {
            "items": [{"item_id": item["item_id"], "item_name": item["name"], "qty": 1}],
            "notes": "Test reject request"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/requests", json=request_data)
        assert create_resp.status_code == 200
        request_id = create_resp.json()["request_id"]
        
        # Reject the request
        reject_resp = self.session.put(
            f"{BASE_URL}/api/stationery/requests/{request_id}/reject",
            json={"reason": "Test rejection reason"}
        )
        assert reject_resp.status_code == 200, f"Failed to reject: {reject_resp.text}"
        
        # Verify status changed
        requests_resp = self.session.get(f"{BASE_URL}/api/stationery/requests")
        req = next((r for r in requests_resp.json() if r["request_id"] == request_id), None)
        
        if req:
            assert req["status"] == "rejected", "Request should be rejected"
        
        print(f"PASS: Request {request_id} rejected")

    # ==================== EMPLOYEES LIST ====================
    def test_get_employees_for_issue(self):
        """GET /api/stationery/employees returns employee list for issue dropdown"""
        response = self.session.get(f"{BASE_URL}/api/stationery/employees")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Employees should be a list"
        
        if len(data) > 0:
            emp = data[0]
            assert "employee_id" in emp, "Employee missing 'employee_id'"
            assert "name" in emp, "Employee missing 'name'"
        
        print(f"PASS: Employees list returned ({len(data)} records)")


class TestStationeryFullFlow:
    """Full flow test: Add item -> Purchase -> Issue -> Return"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_item_id = None
        yield
        
        # Cleanup
        if self.created_item_id:
            try:
                self.session.delete(f"{BASE_URL}/api/stationery/items/{self.created_item_id}")
            except:
                pass

    def test_full_stationery_flow(self):
        """Test complete flow: Create -> Purchase -> Issue -> Check deduction -> Return -> Check restored"""
        
        # Step 1: Create item with opening stock
        print("\n--- Step 1: Create Item ---")
        item_data = {
            "name": "TEST_Full Flow Stapler",
            "category": "Staplers/Pins",
            "unit": "pieces",
            "purchase_price": 150.00,
            "opening_stock": 10,
            "min_stock_level": 3
        }
        create_resp = self.session.post(f"{BASE_URL}/api/stationery/items", json=item_data)
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        item = create_resp.json()
        item_id = item["item_id"]
        self.created_item_id = item_id
        assert item["current_stock"] == 10, "Opening stock should be 10"
        print(f"Created item {item_id} with stock: {item['current_stock']}")
        
        # Step 2: Purchase more stock
        print("\n--- Step 2: Purchase Stock ---")
        purchase_resp = self.session.post(f"{BASE_URL}/api/stationery/purchase", json={
            "item_id": item_id,
            "qty": 20,
            "price_per_unit": 145.00,
            "vendor": "Office Supplies Co"
        })
        assert purchase_resp.status_code == 200, f"Purchase failed: {purchase_resp.text}"
        assert purchase_resp.json()["new_stock"] == 30, "Stock should be 30 after purchase"
        print(f"Purchased 20 units, new stock: {purchase_resp.json()['new_stock']}")
        
        # Step 3: Issue to employee
        print("\n--- Step 3: Issue to Employee ---")
        issue_resp = self.session.post(f"{BASE_URL}/api/stationery/issue", json={
            "item_id": item_id,
            "qty": 5,
            "employee_id": "EMP001",
            "employee_name": "Test Employee",
            "notes": "For office use"
        })
        assert issue_resp.status_code == 200, f"Issue failed: {issue_resp.text}"
        assert issue_resp.json()["new_stock"] == 25, "Stock should be 25 after issue"
        print(f"Issued 5 units, new stock: {issue_resp.json()['new_stock']}")
        
        # Step 4: Verify stock deduction
        print("\n--- Step 4: Verify Stock Deduction ---")
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        current_item = next((i for i in items_resp.json()["items"] if i["item_id"] == item_id), None)
        assert current_item is not None, "Item not found"
        assert current_item["current_stock"] == 25, f"Stock should be 25, got {current_item['current_stock']}"
        print(f"Verified stock is 25")
        
        # Step 5: Return item
        print("\n--- Step 5: Return Item ---")
        return_resp = self.session.post(f"{BASE_URL}/api/stationery/return", json={
            "item_id": item_id,
            "qty": 3,
            "employee_name": "Test Employee",
            "notes": "Returning unused staplers"
        })
        assert return_resp.status_code == 200, f"Return failed: {return_resp.text}"
        assert return_resp.json()["new_stock"] == 28, "Stock should be 28 after return"
        print(f"Returned 3 units, new stock: {return_resp.json()['new_stock']}")
        
        # Step 6: Verify stock restored
        print("\n--- Step 6: Verify Stock Restored ---")
        items_resp = self.session.get(f"{BASE_URL}/api/stationery/items")
        final_item = next((i for i in items_resp.json()["items"] if i["item_id"] == item_id), None)
        assert final_item["current_stock"] == 28, f"Final stock should be 28, got {final_item['current_stock']}"
        print(f"Verified final stock is 28")
        
        # Step 7: Check transaction history
        print("\n--- Step 7: Verify Transaction History ---")
        txn_resp = self.session.get(f"{BASE_URL}/api/stationery/transactions?item_id={item_id}")
        assert txn_resp.status_code == 200
        txns = txn_resp.json()
        
        # Should have: opening stock purchase + purchase + issue + return = 4 transactions
        item_txns = [t for t in txns if t["item_id"] == item_id]
        assert len(item_txns) >= 3, f"Should have at least 3 transactions, got {len(item_txns)}"
        
        types = [t["type"] for t in item_txns]
        assert "purchase" in types, "Should have purchase transaction"
        assert "issue" in types, "Should have issue transaction"
        assert "return" in types, "Should have return transaction"
        print(f"Found {len(item_txns)} transactions for item: {types}")
        
        print("\n=== FULL FLOW TEST PASSED ===")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
