import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  Users,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileWarning,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const BulkImportPage = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin';

  const handleDownloadTemplate = async (type) => {
    try {
      const response = await fetch(`${API_URL}/import/templates/${type}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_import_template.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Template downloaded');
      } else {
        toast.error('Failed to download template');
      }
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  // Function to generate and download error report
  const downloadErrorReport = (type, errors) => {
    if (!errors || errors.length === 0) return;

    // Create CSV content
    const headers = ['Row Number', 'Error Description'];
    const csvContent = [
      headers.join(','),
      ...errors.map(err => `${err.row},"${err.error.replace(/"/g, '""')}"`)
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleFileUpload = async (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/import/${type}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        const uploadData = {
          type,
          typeName: importTypes.find(t => t.id === type)?.title || type,
          success: true,
          imported: result.imported,
          errors: result.errors || [],
          total: result.total_rows
        };
        
        setUploadResult(uploadData);
        setShowResultDialog(true);

        // Auto-download error report if there are errors
        if (result.errors && result.errors.length > 0) {
          setTimeout(() => {
            downloadErrorReport(type, result.errors);
          }, 500);
        }
      } else {
        setUploadResult({
          type,
          typeName: importTypes.find(t => t.id === type)?.title || type,
          success: false,
          error: result.detail || 'Import failed',
          imported: 0,
          errors: [],
          total: 0
        });
        setShowResultDialog(true);
      }
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleExport = async (type) => {
    try {
      const response = await fetch(`${API_URL}/import/export/${type}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Export downloaded');
      } else {
        toast.error('Failed to export data');
      }
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const closeDialog = () => {
    setShowResultDialog(false);
  };

  if (!isHR) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-600">You don't have permission to access this page</p>
      </div>
    );
  }

  const importTypes = [
    {
      id: 'employees',
      title: 'Employee Data',
      description: 'Import employee profiles with personal and employment details',
      icon: Users,
      color: 'bg-blue-100 text-blue-700',
      fields: ['first_name', 'last_name', 'email', 'phone', 'department_code', 'designation_code', 'joining_date']
    },
    {
      id: 'attendance',
      title: 'Attendance Records',
      description: 'Bulk upload attendance data with punch times',
      icon: Clock,
      color: 'bg-emerald-100 text-emerald-700',
      fields: ['employee_id', 'date', 'first_in', 'last_out', 'status']
    },
    {
      id: 'salary',
      title: 'Salary Structures',
      description: 'Import salary details and bank information',
      icon: IndianRupee,
      color: 'bg-purple-100 text-purple-700',
      fields: ['employee_id', 'ctc', 'basic', 'hra', 'bank_name', 'bank_account', 'pan_number']
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bulk-import-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Bulk Import & Export
          </h1>
          <p className="text-slate-600 mt-1">Import data from CSV files or export existing data</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => handleExport('employees')}>
          <Download className="w-4 h-4" />
          Export All Employees
        </Button>
      </div>

      {/* Import Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {importTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <Card key={type.id} className="overflow-hidden" data-testid={`import-${type.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{type.title}</CardTitle>
                </div>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fields Info */}
                <div className="flex flex-wrap gap-1">
                  {type.fields.slice(0, 4).map((field) => (
                    <Badge key={field} variant="outline" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                  {type.fields.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{type.fields.length - 4} more
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleDownloadTemplate(type.id)}
                  >
                    <Download className="w-4 h-4" />
                    Template
                  </Button>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      id={`upload-${type.id}`}
                      onChange={(e) => handleFileUpload(type.id, e)}
                      disabled={uploading}
                    />
                    <label htmlFor={`upload-${type.id}`}>
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        disabled={uploading}
                        asChild
                      >
                        <span>
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          Upload
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Import Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadResult?.success ? (
                uploadResult?.errors?.length > 0 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Import Completed with Errors
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Import Successful
                  </>
                )
              ) : (
                <>
                  <X className="w-5 h-5 text-red-500" />
                  Import Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {uploadResult?.typeName} import results
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {uploadResult?.success ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{uploadResult.total}</p>
                    <p className="text-xs text-slate-500">Total Records</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{uploadResult.imported}</p>
                    <p className="text-xs text-green-600">Imported</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{uploadResult.errors?.length || 0}</p>
                    <p className="text-xs text-red-600">Errors</p>
                  </div>
                </div>

                {/* Error Details */}
                {uploadResult.errors?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2">
                        <FileWarning className="w-4 h-4 text-amber-500" />
                        Error Details
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => downloadErrorReport(uploadResult.type, uploadResult.errors)}
                      >
                        <Download className="w-3 h-3" />
                        Download Error Report
                      </Button>
                    </div>
                    
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Row</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadResult.errors.slice(0, 10).map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">{err.row}</TableCell>
                              <TableCell className="text-sm text-red-600">{err.error}</TableCell>
                            </TableRow>
                          ))}
                          {uploadResult.errors.length > 10 && (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-slate-500 text-sm">
                                ... and {uploadResult.errors.length - 10} more errors (see downloaded report)
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Error report has been automatically downloaded
                    </p>
                  </div>
                )}

                {uploadResult.errors?.length === 0 && (
                  <div className="text-center py-4 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-green-700 font-medium">All records imported successfully!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-red-50 rounded-lg">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                <p className="text-red-700 font-medium">{uploadResult?.error}</p>
                <p className="text-red-600 text-sm mt-1">Please check your file and try again</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={closeDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkImportPage;
