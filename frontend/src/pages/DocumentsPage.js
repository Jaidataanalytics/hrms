import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  File,
  FileImage,
  FileBadge,
  Plus,
  Trash2,
  Search
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DocumentsPage = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: '',
    description: '',
    file: null
  });

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';

  useEffect(() => {
    fetchData();
  }, [filterType]);

  const fetchData = async () => {
    try {
      let url = `${API_URL}/documents?`;
      if (filterType !== 'all') url += `type=${filterType}`;

      const [docsRes, typesRes] = await Promise.all([
        fetch(url, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/document-types`, { credentials: 'include', headers: getAuthHeaders() })
      ]);

      if (docsRes.ok) setDocuments(await docsRes.json());
      if (typesRes.ok) setDocumentTypes(await typesRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!form.name || !form.type) {
      toast.error('Please fill required fields');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('type', form.type);
      formData.append('description', form.description || '');
      if (form.file) {
        formData.append('file', form.file);
      }

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('Document uploaded');
        setShowUpload(false);
        setForm({ name: '', type: '', description: '', file: null });
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to upload');
      }
    } catch (error) {
      toast.error('Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`${API_URL}/documents/${documentId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Document deleted');
        fetchData();
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleDownload = async (documentId, fileName) => {
    try {
      const response = await fetch(`${API_URL}/documents/${documentId}/download`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        toast.error('Failed to download');
      }
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const handleVerify = async (documentId) => {
    try {
      const response = await fetch(`${API_URL}/documents/${documentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (response.ok) {
        toast.success('Document verified');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to verify');
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      'id_proof': FileBadge,
      'address_proof': FileText,
      'education': FileText,
      'pan_card': FileBadge,
      'aadhaar': FileBadge,
      'photo': FileImage
    };
    return icons[type] || File;
  };

  const getTypeName = (code) => documentTypes.find(t => t.type_id === code || t.code === code)?.name || code;

  // Stats
  const totalDocs = documents.length;
  const verifiedDocs = documents.filter(d => d.is_verified).length;
  const pendingDocs = documents.filter(d => !d.is_verified).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="documents-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="section-pill mono-accent">// Documents</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Document Management
          </h1>
          <p className="text-slate-600 mt-1">Upload and manage employee documents</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>Add a new document to your profile</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="e.g., PAN Card"
                />
              </div>
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.type_id} value={type.type_id}>
                        {type.name} {type.is_mandatory && <span className="text-red-500">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Optional notes"
                />
              </div>
              <div className="space-y-2">
                <Label>File</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setForm({...form, file: e.target.files?.[0] || null})}
                />
                <p className="text-xs text-slate-400">PDF, JPG, PNG, DOC up to 10MB</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDocs}</p>
                <p className="text-xs text-slate-500">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{verifiedDocs}</p>
                <p className="text-xs text-slate-500">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingDocs}</p>
                <p className="text-xs text-slate-500">Pending Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {documentTypes.map(type => (
              <SelectItem key={type.type_id} value={type.type_id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            My Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length > 0 ? documents
                .filter(doc => !searchTerm || doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) || doc.description?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((doc) => {
                const TypeIcon = getTypeIcon(doc.type);
                return (
                  <TableRow key={doc.document_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <TypeIcon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          {doc.description && (
                            <p className="text-xs text-slate-500">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeName(doc.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={doc.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                        {doc.is_verified ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {doc.file_name && (
                          <>
                            <Button size="sm" variant="ghost" title="View" onClick={() => handleDownload(doc.document_id, doc.file_name)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Download" onClick={() => handleDownload(doc.document_id, doc.file_name)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" title="Delete" onClick={() => handleDelete(doc.document_id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {isHR && !doc.is_verified && (
                          <Button size="sm" onClick={() => handleVerify(doc.document_id)}>
                            Verify
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No documents uploaded</p>
                    <Button onClick={() => setShowUpload(true)}>Upload First Document</Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Required Documents Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Required Documents Checklist</CardTitle>
          <CardDescription>Mandatory documents for your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {documentTypes.filter(t => t.is_mandatory).map(type => {
              const hasDoc = documents.some(d => d.type === type.type_id);
              const isVerified = documents.find(d => d.type === type.type_id)?.is_verified;
              return (
                <div key={type.type_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">{type.name}</span>
                  <Badge className={isVerified ? 'bg-emerald-100 text-emerald-700' : hasDoc ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                    {isVerified ? 'Verified' : hasDoc ? 'Pending' : 'Missing'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsPage;
