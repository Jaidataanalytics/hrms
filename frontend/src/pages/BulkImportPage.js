import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const BulkImportPage = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

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
        setUploadResult({
          type,
          success: true,
          imported: result.imported,
          errors: result.errors,
          total: result.total_rows
        });
        toast.success(`Imported ${result.imported} records`);
      } else {
        setUploadResult({
          type,
          success: false,
          error: result.detail || 'Import failed'
        });
        toast.error(result.detail || 'Import failed');
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

      {/* Upload Result */}
      {uploadResult && (
        <Alert className={uploadResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          {uploadResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle className={uploadResult.success ? 'text-emerald-800' : 'text-red-800'}>
            {uploadResult.success ? 'Import Completed' : 'Import Failed'}
          </AlertTitle>
          <AlertDescription className={uploadResult.success ? 'text-emerald-700' : 'text-red-700'}>
            {uploadResult.success ? (
              <>
                Successfully imported {uploadResult.imported} out of {uploadResult.total} records.
                {uploadResult.errors?.length > 0 && (
                  <span className="block mt-1">
                    {uploadResult.errors.length} records had errors.
                  </span>
                )}
              </>
            ) : (
              uploadResult.error
            )}
          </AlertDescription>
        </Alert>
      )}

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

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">How to Import</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                <li>Download the template CSV file for the data type you want to import</li>
                <li>Fill in the data following the template format</li>
                <li>Save the file as CSV (UTF-8 encoded)</li>
                <li>Upload the file using the Upload button</li>
                <li>Review the import results for any errors</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Important Notes</h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-slate-600">
                <li>First row must contain column headers</li>
                <li>Date format: YYYY-MM-DD (e.g., 2025-01-15)</li>
                <li>Time format: HH:MM (e.g., 09:30)</li>
                <li>Use department/designation codes, not names</li>
                <li>Email addresses must be unique</li>
                <li>Maximum 1000 records per upload</li>
              </ul>
            </div>
          </div>

          {/* Error Examples */}
          {uploadResult?.errors?.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">Import Errors</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {uploadResult.errors.slice(0, 10).map((err, idx) => (
                  <p key={idx} className="text-sm text-red-600">
                    Row {err.row}: {err.error}
                  </p>
                ))}
                {uploadResult.errors.length > 10 && (
                  <p className="text-sm text-red-600 font-medium">
                    ... and {uploadResult.errors.length - 10} more errors
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkImportPage;
