import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import {
  Package, Plus, Search, RefreshCw, ShoppingCart, ArrowDownToLine, RotateCcw,
  AlertTriangle, IndianRupee, Edit, Trash2, FileText, ClipboardList, CheckCircle,
  XCircle, Clock, Send
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/stationery';

const StationeryTab = ({ authHeaders, isAdmin, userId }) => {
  const hdrs = { headers: { ...authHeaders, 'Content-Type': 'application/json' } };
  const hdrsGet = { headers: authHeaders };

  // Data
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total_items: 0, total_value: 0, low_stock_count: 0 });
  const [transactions, setTransactions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  // UI state
  const [subView, setSubView] = useState('stock');
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [txnFilter, setTxnFilter] = useState('all');

  // Dialogs
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [empSearchQ, setEmpSearchQ] = useState('');

  // Forms
  const emptyItemForm = { name: '', category: 'Pens', unit: 'pieces', purchase_price: '', opening_stock: '', min_stock_level: '5' };
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [purchaseForm, setPurchaseForm] = useState({ item_id: '', qty: '', price_per_unit: '', vendor: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  const [issueForm, setIssueForm] = useState({ item_id: '', qty: '', employee_id: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  const [returnForm, setReturnForm] = useState({ item_id: '', qty: '', employee_id: '', employee_name: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  const [requestForm, setRequestForm] = useState({ items: [{ item_id: '', qty: '1' }], notes: '' });

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (catFilter !== 'all') params.set('category', catFilter);
      if (searchQ) params.set('search', searchQ);
      const r = await fetch(`${API}/items?${params}`, hdrsGet);
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
        setStats({ total_items: d.total_items, total_value: d.total_value, low_stock_count: d.low_stock_count });
      }
    } catch (e) { console.error(e); }
  }, [catFilter, searchQ]);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (txnFilter !== 'all') params.set('type', txnFilter);
      const r = await fetch(`${API}/transactions?${params}`, hdrsGet);
      if (r.ok) setTransactions(await r.json());
    } catch (e) { console.error(e); }
  }, [txnFilter]);

  const fetchRequests = useCallback(async () => {
    try {
      const r = await fetch(`${API}/requests`, hdrsGet);
      if (r.ok) setRequests(await r.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [cR, eR] = await Promise.all([
        fetch(`${API}/categories`, hdrsGet),
        isAdmin ? fetch(`${API}/employees`, hdrsGet) : Promise.resolve(null),
      ]);
      if (cR.ok) { const d = await cR.json(); setCategories(d.categories); setUnits(d.units); }
      if (eR?.ok) setEmployees(await eR.json());
    } catch (e) { console.error(e); }
  }, [isAdmin]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { if (subView === 'history') fetchTransactions(); }, [subView, fetchTransactions]);
  useEffect(() => { if (subView === 'requests') fetchRequests(); }, [subView, fetchRequests]);

  // ---- Actions ----
  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Item name is required');
    try {
      const url = editItem ? `${API}/items/${editItem.item_id}` : `${API}/items`;
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch(url, { ...hdrs, method, body: JSON.stringify(itemForm) });
      if (r.ok) { toast.success(editItem ? 'Item updated' : 'Item added'); setShowAddItem(false); setEditItem(null); setItemForm(emptyItemForm); fetchItems(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error saving item'); }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      const r = await fetch(`${API}/items/${id}`, { ...hdrs, method: 'DELETE' });
      if (r.ok) { toast.success('Item deleted'); fetchItems(); }
    } catch (e) { toast.error('Error'); }
  };

  const handlePurchase = async () => {
    if (!purchaseForm.item_id || !purchaseForm.qty) return toast.error('Select item and qty');
    try {
      const r = await fetch(`${API}/purchase`, { ...hdrs, method: 'POST', body: JSON.stringify(purchaseForm) });
      if (r.ok) { toast.success('Stock added'); setShowPurchase(false); setPurchaseForm({ item_id: '', qty: '', price_per_unit: '', vendor: '', notes: '', date: new Date().toISOString().slice(0, 10) }); fetchItems(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error'); }
  };

  const handleIssue = async () => {
    if (!issueForm.item_id || !issueForm.qty || !issueForm.employee_id) return toast.error('Select item, employee and qty');
    try {
      const r = await fetch(`${API}/issue`, { ...hdrs, method: 'POST', body: JSON.stringify(issueForm) });
      if (r.ok) { toast.success('Item issued'); setShowIssue(false); setIssueForm({ item_id: '', qty: '', employee_id: '', notes: '', date: new Date().toISOString().slice(0, 10) }); fetchItems(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error'); }
  };

  const handleReturn = async () => {
    if (!returnForm.item_id || !returnForm.qty) return toast.error('Select item and qty');
    try {
      const r = await fetch(`${API}/return`, { ...hdrs, method: 'POST', body: JSON.stringify(returnForm) });
      if (r.ok) { toast.success('Item returned'); setShowReturn(false); setReturnForm({ item_id: '', qty: '', employee_id: '', employee_name: '', notes: '', date: new Date().toISOString().slice(0, 10) }); fetchItems(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error'); }
  };

  const handleRequest = async () => {
    const validItems = requestForm.items.filter(i => i.item_id && parseInt(i.qty) > 0);
    if (!validItems.length) return toast.error('Add at least one item');
    const enriched = validItems.map(i => {
      const found = items.find(x => x.item_id === i.item_id);
      return { ...i, item_name: found?.name || '', qty: parseInt(i.qty) };
    });
    try {
      const r = await fetch(`${API}/requests`, { ...hdrs, method: 'POST', body: JSON.stringify({ items: enriched, notes: requestForm.notes }) });
      if (r.ok) { toast.success('Request submitted'); setShowRequest(false); setRequestForm({ items: [{ item_id: '', qty: '1' }], notes: '' }); fetchRequests(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error'); }
  };

  const handleApprove = async (reqId) => {
    try {
      const r = await fetch(`${API}/requests/${reqId}/approve`, { ...hdrs, method: 'PUT' });
      if (r.ok) { toast.success('Approved & issued'); fetchRequests(); fetchItems(); }
      else { const e = await r.json(); toast.error(e.detail || 'Failed'); }
    } catch (e) { toast.error('Error'); }
  };

  const handleReject = async (reqId) => {
    const reason = window.prompt('Rejection reason (optional):');
    try {
      const r = await fetch(`${API}/requests/${reqId}/reject`, { ...hdrs, method: 'PUT', body: JSON.stringify({ reason: reason || '' }) });
      if (r.ok) { toast.success('Request rejected'); fetchRequests(); }
    } catch (e) { toast.error('Error'); }
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 border rounded-lg p-0.5">
          {[
            { key: 'stock', label: 'Stock', icon: Package },
            { key: 'history', label: 'History', icon: FileText },
            { key: 'requests', label: 'Requests', icon: ClipboardList },
          ].map(v => (
            <button key={v.key} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${subView === v.key ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubView(v.key)} data-testid={`stn-view-${v.key}`}>
              <v.icon className="w-3.5 h-3.5" />{v.label}
              {v.key === 'requests' && requests.filter(r => r.status === 'pending').length > 0 && (
                <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0">{requests.filter(r => r.status === 'pending').length}</Badge>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <Button size="sm" onClick={() => { setShowRequest(true); if (!items.length) fetchItems(); }} data-testid="stn-request-btn">
              <Send className="w-3.5 h-3.5 mr-1" />Request Stationery
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowPurchase(true)} data-testid="stn-purchase-btn">
                <ShoppingCart className="w-3.5 h-3.5 mr-1" />Purchase
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowIssue(true)} data-testid="stn-issue-btn">
                <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />Issue
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReturn(true)} data-testid="stn-return-btn">
                <RotateCcw className="w-3.5 h-3.5 mr-1" />Return
              </Button>
              <Button size="sm" onClick={() => { setEditItem(null); setItemForm(emptyItemForm); setShowAddItem(true); }} data-testid="stn-add-item-btn">
                <Plus className="w-3.5 h-3.5 mr-1" />Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ======= STOCK VIEW ======= */}
      {subView === 'stock' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-slate-500">Total Items</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_items}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-slate-500">Total Value</p>
                <p className="text-2xl font-bold text-emerald-700 flex items-center"><IndianRupee className="w-5 h-5" />{stats.total_value.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${stats.low_stock_count > 0 ? 'border-l-red-500' : 'border-l-slate-200'}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-slate-500">Low Stock Alerts</p>
                <p className={`text-2xl font-bold ${stats.low_stock_count > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.low_stock_count}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search items..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9" data-testid="stn-search" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px] h-9" data-testid="stn-cat-filter"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchItems}><RefreshCw className="w-4 h-4" /></Button>
          </div>

          {/* Items table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">No stationery items yet</TableCell></TableRow>
                    ) : items.map(item => {
                      const isLow = item.current_stock <= item.min_stock_level;
                      return (
                        <TableRow key={item.item_id} data-testid={`stn-item-${item.item_id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              <span className="font-medium text-sm">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{item.current_stock}</span>
                            {isLow && <span className="text-xs text-red-400 block">min: {item.min_stock_level}</span>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{item.unit}</TableCell>
                          <TableCell className="text-right text-sm">{item.purchase_price}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{(item.current_stock * item.purchase_price).toLocaleString()}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditItem(item); setItemForm({ name: item.name, category: item.category, unit: item.unit, purchase_price: String(item.purchase_price), opening_stock: '', min_stock_level: String(item.min_stock_level) }); setShowAddItem(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteItem(item.item_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ======= HISTORY VIEW ======= */}
      {subView === 'history' && (
        <>
          <div className="flex gap-2 items-center">
            <Select value={txnFilter} onValueChange={setTxnFilter}>
              <SelectTrigger className="w-[160px] h-9" data-testid="stn-txn-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
                <SelectItem value="issue">Issues</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchTransactions}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Vendor/Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No transactions yet</TableCell></TableRow>
                    ) : transactions.map(t => (
                      <TableRow key={t.txn_id} data-testid={`stn-txn-${t.txn_id}`}>
                        <TableCell className="text-sm">{t.date}</TableCell>
                        <TableCell>
                          <Badge className={t.type === 'purchase' ? 'bg-blue-100 text-blue-700' : t.type === 'issue' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                            {t.type === 'purchase' ? <ShoppingCart className="w-3 h-3 mr-1" /> : t.type === 'issue' ? <ArrowDownToLine className="w-3 h-3 mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{t.item_name}</TableCell>
                        <TableCell className="text-center font-bold">{t.type === 'issue' ? `-${t.qty}` : `+${t.qty}`}</TableCell>
                        <TableCell className="text-sm">{t.employee_name || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-500">{t.vendor || t.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ======= REQUESTS VIEW ======= */}
      {subView === 'requests' && (
        <>
          {!isAdmin && (
            <Button size="sm" onClick={() => { setShowRequest(true); if (!items.length) fetchItems(); }} data-testid="stn-request-btn-2">
              <Send className="w-3.5 h-3.5 mr-1" />New Request
            </Button>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">No requests yet</TableCell></TableRow>
                    ) : requests.map(req => (
                      <TableRow key={req.request_id} data-testid={`stn-req-${req.request_id}`}>
                        <TableCell className="text-xs font-mono">{req.request_id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{req.employee_name}</p>
                            <p className="text-xs text-slate-400">{req.department}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {req.items?.map((i, idx) => (
                              <span key={`item-${idx}`} className="text-xs">{i.item_name} x{i.qty}{idx < req.items.length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {req.status === 'pending' ? <Clock className="w-3 h-3 mr-1" /> : req.status === 'approved' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{req.created_at?.slice(0, 10)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {req.status === 'pending' && (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-300" onClick={() => handleApprove(req.request_id)} data-testid={`approve-${req.request_id}`}>
                                  <CheckCircle className="w-3 h-3 mr-1" />Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300" onClick={() => handleReject(req.request_id)} data-testid={`reject-${req.request_id}`}>
                                  <XCircle className="w-3 h-3 mr-1" />Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ======= ADD/EDIT ITEM DIALOG ======= */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="sm:max-w-md" data-testid="stn-item-dialog">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Item' : 'Add Stationery Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} data-testid="stn-item-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm({ ...itemForm, category: v })}>
                  <SelectTrigger data-testid="stn-item-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm({ ...itemForm, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Price/Unit</Label><Input type="number" value={itemForm.purchase_price} onChange={e => setItemForm({ ...itemForm, purchase_price: e.target.value })} /></div>
              {!editItem && <div><Label>Opening Stock</Label><Input type="number" value={itemForm.opening_stock} onChange={e => setItemForm({ ...itemForm, opening_stock: e.target.value })} /></div>}
              <div><Label>Min Stock</Label><Input type="number" value={itemForm.min_stock_level} onChange={e => setItemForm({ ...itemForm, min_stock_level: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} data-testid="stn-item-save">{editItem ? 'Update' : 'Add Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= PURCHASE DIALOG ======= */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="sm:max-w-md" data-testid="stn-purchase-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-600" />Purchase Stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item *</Label>
              <Select value={purchaseForm.item_id} onValueChange={v => { const it = items.find(i => i.item_id === v); setPurchaseForm({ ...purchaseForm, item_id: v, price_per_unit: String(it?.purchase_price || '') }); }}>
                <SelectTrigger data-testid="stn-purchase-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.name} (Stock: {i.current_stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity *</Label><Input type="number" value={purchaseForm.qty} onChange={e => setPurchaseForm({ ...purchaseForm, qty: e.target.value })} data-testid="stn-purchase-qty" /></div>
              <div><Label>Price/Unit</Label><Input type="number" value={purchaseForm.price_per_unit} onChange={e => setPurchaseForm({ ...purchaseForm, price_per_unit: e.target.value })} /></div>
            </div>
            <div><Label>Vendor</Label><Input value={purchaseForm.vendor} onChange={e => setPurchaseForm({ ...purchaseForm, vendor: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={purchaseForm.date} onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={purchaseForm.notes} onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchase(false)}>Cancel</Button>
            <Button onClick={handlePurchase} data-testid="stn-purchase-save">Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= ISSUE DIALOG ======= */}
      <Dialog open={showIssue} onOpenChange={(o) => { setShowIssue(o); if (!o) setEmpSearchQ(''); }}>
        <DialogContent className="sm:max-w-md" data-testid="stn-issue-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-amber-600" />Issue Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item *</Label>
              <Select value={issueForm.item_id} onValueChange={v => setIssueForm({ ...issueForm, item_id: v })}>
                <SelectTrigger data-testid="stn-issue-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.name} (Stock: {i.current_stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee *</Label>
              <Input placeholder="Search employee..." value={empSearchQ} onChange={e => setEmpSearchQ(e.target.value)} className="mb-1" data-testid="stn-issue-emp-search" />
              <div className="max-h-[150px] overflow-y-auto border rounded-md">
                {employees.filter(e => {
                  if (!empSearchQ) return true;
                  const q = empSearchQ.toLowerCase();
                  return e.name?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q);
                }).map(e => (
                  <div key={e.employee_id} className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 border-b last:border-0 ${issueForm.employee_id === e.employee_id ? 'bg-primary/10 font-medium' : ''}`}
                    onClick={() => setIssueForm({ ...issueForm, employee_id: e.employee_id })}>
                    <span>{e.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{e.department}</span>
                  </div>
                ))}
              </div>
              {issueForm.employee_id && <p className="text-xs text-emerald-600 mt-1">Selected: {employees.find(e => e.employee_id === issueForm.employee_id)?.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity *</Label><Input type="number" value={issueForm.qty} onChange={e => setIssueForm({ ...issueForm, qty: e.target.value })} data-testid="stn-issue-qty" /></div>
              <div><Label>Date</Label><Input type="date" value={issueForm.date} onChange={e => setIssueForm({ ...issueForm, date: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={issueForm.notes} onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button>
            <Button onClick={handleIssue} data-testid="stn-issue-save">Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= RETURN DIALOG ======= */}
      <Dialog open={showReturn} onOpenChange={setShowReturn}>
        <DialogContent className="sm:max-w-md" data-testid="stn-return-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-emerald-600" />Return Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item *</Label>
              <Select value={returnForm.item_id} onValueChange={v => setReturnForm({ ...returnForm, item_id: v })}>
                <SelectTrigger data-testid="stn-return-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employee Name</Label><Input value={returnForm.employee_name} onChange={e => setReturnForm({ ...returnForm, employee_name: e.target.value })} /></div>
              <div><Label>Quantity *</Label><Input type="number" value={returnForm.qty} onChange={e => setReturnForm({ ...returnForm, qty: e.target.value })} data-testid="stn-return-qty" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={returnForm.date} onChange={e => setReturnForm({ ...returnForm, date: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturn(false)}>Cancel</Button>
            <Button onClick={handleReturn} data-testid="stn-return-save">Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= REQUEST DIALOG (Employee) ======= */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-md" data-testid="stn-request-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" />Request Stationery</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {requestForm.items.map((ri, idx) => (
              <div key={`req-item-${idx}`} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className={idx > 0 ? 'sr-only' : ''}>Item</Label>
                  <Select value={ri.item_id} onValueChange={v => { const updated = [...requestForm.items]; updated[idx].item_id = v; setRequestForm({ ...requestForm, items: updated }); }}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className={idx > 0 ? 'sr-only' : ''}>Qty</Label>
                  <Input type="number" value={ri.qty} min="1" onChange={e => { const updated = [...requestForm.items]; updated[idx].qty = e.target.value; setRequestForm({ ...requestForm, items: updated }); }} />
                </div>
                {requestForm.items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => { const updated = requestForm.items.filter((_, i) => i !== idx); setRequestForm({ ...requestForm, items: updated }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setRequestForm({ ...requestForm, items: [...requestForm.items, { item_id: '', qty: '1' }] })}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add Another Item
            </Button>
            <div><Label>Notes</Label><Textarea value={requestForm.notes} onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequest(false)}>Cancel</Button>
            <Button onClick={handleRequest} data-testid="stn-request-save">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StationeryTab;
