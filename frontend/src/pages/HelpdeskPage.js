import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
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
  HelpCircle,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  User,
  Lock,
  Lightbulb,
  ClipboardList,
  BarChart3,
  Send,
  Trash2,
  Edit,
  Eye,
  Users,
  Building2,
  MapPin,
  Star,
  ThumbsUp,
  FileText,
  Play,
  Copy,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const HelpdeskPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('complaints');
  
  // Complaints state
  const [tickets, setTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    category: 'general',
    subject: '',
    description: '',
    priority: 'medium',
    is_anonymous: false
  });
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [suggestionForm, setSuggestionForm] = useState({
    title: '',
    description: '',
    category: 'general',
    is_anonymous: false
  });
  const [suggestionResponse, setSuggestionResponse] = useState('');
  
  // Surveys state
  const [surveys, setSurveys] = useState([]);
  const [showCreateSurvey, setShowCreateSurvey] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [surveyTemplates, setSurveyTemplates] = useState({ builtin_templates: [], saved_templates: [] });
  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    survey_type: 'custom',
    is_anonymous: false,
    is_mandatory: false,
    allow_edit: true,
    target_type: 'all',
    target_employees: [],
    target_departments: [],
    target_locations: [],
    questions: [],
    end_date: ''
  });
  const [surveyResponses, setSurveyResponses] = useState(null);
  const [surveyAnalytics, setSurveyAnalytics] = useState(null);
  
  // Employee selection state
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  // Survey response state (for employees)
  const [showRespondSurvey, setShowRespondSurvey] = useState(false);
  const [respondingSurvey, setRespondingSurvey] = useState(null);
  const [surveyAnswers, setSurveyAnswers] = useState({});

  const isHR = user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr_executive';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'complaints') {
        await fetchTickets();
      } else if (activeTab === 'suggestions') {
        await fetchSuggestions();
      } else if (activeTab === 'surveys') {
        await fetchSurveys();
        if (isHR) {
          await fetchSurveyHelpers();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMPLAINTS ====================
  
  const fetchTickets = async () => {
    try {
      let url = `${API_URL}/grievances?`;
      if (filterStatus !== 'all') url += `status=${filterStatus}`;
      const response = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (response.ok) setTickets(await response.json());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.subject || !ticketForm.description) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(ticketForm)
      });
      if (response.ok) {
        toast.success('Ticket submitted');
        setShowCreateTicket(false);
        setTicketForm({ category: 'general', subject: '', description: '', priority: 'medium', is_anonymous: false });
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to submit ticket');
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      const response = await fetch(`${API_URL}/grievances/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        toast.success('Status updated');
        fetchTickets();
        setSelectedTicket(null);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // ==================== SUGGESTIONS ====================
  
  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/suggestions`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) setSuggestions(await response.json());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCreateSuggestion = async () => {
    if (!suggestionForm.title || !suggestionForm.description) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/helpdesk/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(suggestionForm)
      });
      if (response.ok) {
        toast.success('Suggestion submitted');
        setShowCreateSuggestion(false);
        setSuggestionForm({ title: '', description: '', category: 'general', is_anonymous: false });
        fetchSuggestions();
      }
    } catch (error) {
      toast.error('Failed to submit suggestion');
    }
  };

  const handleRespondToSuggestion = async () => {
    if (!suggestionResponse) {
      toast.error('Please enter a response');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/helpdesk/suggestions/${selectedSuggestion.suggestion_id}/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ response: suggestionResponse, status: 'acknowledged' })
      });
      if (response.ok) {
        toast.success('Response sent');
        setSelectedSuggestion(null);
        setSuggestionResponse('');
        fetchSuggestions();
      }
    } catch (error) {
      toast.error('Failed to send response');
    }
  };

  // ==================== SURVEYS ====================
  
  const fetchSurveys = async () => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) setSurveys(await response.json());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchSurveyHelpers = async () => {
    try {
      const [templatesRes, deptRes, locRes, empRes] = await Promise.all([
        fetch(`${API_URL}/helpdesk/survey-templates`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/helpdesk/departments`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/helpdesk/locations`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_URL}/helpdesk/employees-for-selection`, { credentials: 'include', headers: getAuthHeaders() })
      ]);
      
      if (templatesRes.ok) setSurveyTemplates(await templatesRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCreateSurvey = async () => {
    if (!surveyForm.title || surveyForm.questions.length === 0) {
      toast.error('Please add a title and at least one question');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ ...surveyForm, status: 'draft' })
      });
      if (response.ok) {
        toast.success('Survey created as draft');
        setShowCreateSurvey(false);
        resetSurveyForm();
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to create survey');
    }
  };

  const handleActivateSurvey = async (surveyId) => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}/activate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Survey activated and notifications sent');
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to activate survey');
    }
  };

  const handleCloseSurvey = async (surveyId) => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}/close`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Survey closed');
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to close survey');
    }
  };

  const handleDeleteSurvey = async (surveyId) => {
    if (!window.confirm('Delete this survey and all responses?')) return;
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Survey deleted');
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to delete survey');
    }
  };

  const handleDuplicateSurvey = async (surveyId) => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Survey duplicated');
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to duplicate survey');
    }
  };

  const fetchSurveyAnalytics = async (surveyId) => {
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}/analytics`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setSurveyAnalytics(await response.json());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Survey response (for employees)
  const handleOpenSurveyToRespond = async (survey) => {
    setRespondingSurvey(survey);
    setSurveyAnswers({});
    
    // Check if already responded
    if (survey.my_response) {
      // Pre-fill answers
      const answers = {};
      survey.my_response.answers?.forEach(a => {
        answers[a.question_id] = a;
      });
      setSurveyAnswers(answers);
    }
    
    setShowRespondSurvey(true);
  };

  const handleSubmitSurveyResponse = async () => {
    const answersArray = Object.values(surveyAnswers);
    
    try {
      const response = await fetch(`${API_URL}/helpdesk/surveys/${respondingSurvey.survey_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ answers: answersArray })
      });
      if (response.ok) {
        toast.success('Response submitted');
        setShowRespondSurvey(false);
        fetchSurveys();
      }
    } catch (error) {
      toast.error('Failed to submit response');
    }
  };

  const resetSurveyForm = () => {
    setSurveyForm({
      title: '',
      description: '',
      survey_type: 'custom',
      is_anonymous: false,
      is_mandatory: false,
      allow_edit: true,
      target_type: 'all',
      target_employees: [],
      target_departments: [],
      target_locations: [],
      questions: [],
      end_date: ''
    });
  };

  const addQuestion = () => {
    const newQ = {
      question_id: `q_${Date.now()}`,
      type: 'rating',
      text: '',
      scale: 5,
      options: [],
      required: true
    };
    setSurveyForm({ ...surveyForm, questions: [...surveyForm.questions, newQ] });
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...surveyForm.questions];
    updated[index] = { ...updated[index], [field]: value };
    setSurveyForm({ ...surveyForm, questions: updated });
  };

  const removeQuestion = (index) => {
    const updated = surveyForm.questions.filter((_, i) => i !== index);
    setSurveyForm({ ...surveyForm, questions: updated });
  };

  const loadTemplate = (template) => {
    setSurveyForm({
      ...surveyForm,
      title: template.title || template.template_name,
      description: template.description || '',
      survey_type: template.survey_type,
      questions: template.questions.map(q => ({
        ...q,
        question_id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      }))
    });
    toast.success('Template loaded');
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      scheduled: 'bg-blue-100 text-blue-700',
      active: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-600',
      open: 'bg-amber-100 text-amber-700',
      in_progress: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      submitted: 'bg-blue-100 text-blue-700',
      under_review: 'bg-amber-100 text-amber-700',
      acknowledged: 'bg-green-100 text-green-700',
      implemented: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-slate-100 text-slate-600',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return styles[priority] || 'bg-slate-100 text-slate-600';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <span className="section-pill mono-accent">// Helpdesk</span>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            <HelpCircle className="w-7 h-7 text-primary" />
            Helpdesk
          </h1>
          <p className="text-slate-500">Complaints, suggestions, and surveys</p>
            <div className="header-accent-line mt-3 max-w-[160px]" />
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="complaints" className="gap-2">
            <AlertCircle className="w-4 h-4" /> Complaints
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="w-4 h-4" /> Suggestions
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-2">
            <ClipboardList className="w-4 h-4" /> Surveys
          </TabsTrigger>
        </TabsList>

        {/* ==================== COMPLAINTS TAB ==================== */}
        <TabsContent value="complaints" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Complaints & Tickets</CardTitle>
                  <CardDescription>Submit and track workplace issues</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowCreateTicket(true)}>
                    <Plus className="w-4 h-4 mr-1" /> New Ticket
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.ticket_id}>
                        <TableCell className="font-mono text-sm">{ticket.ticket_id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ticket.subject}</p>
                            {ticket.is_anonymous && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Anonymous
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{ticket.category?.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge className={getPriorityBadge(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(ticket.status)}>
                            {ticket.status?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatDate(ticket.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(ticket)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No tickets found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SUGGESTIONS TAB ==================== */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Anonymous Suggestions</CardTitle>
                  <CardDescription>
                    Submit ideas and suggestions {!isSuperAdmin && '(anonymous to HR)'}
                  </CardDescription>
                </div>
                <Button onClick={() => setShowCreateSuggestion(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New Suggestion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <Card key={suggestion.suggestion_id} className="border">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{suggestion.title}</h3>
                              <Badge className={getStatusBadge(suggestion.status)}>
                                {suggestion.status?.replace('_', ' ')}
                              </Badge>
                              {suggestion.is_anonymous && (
                                <Badge variant="outline" className="text-xs">
                                  <Lock className="w-3 h-3 mr-1" /> Anonymous
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-600 text-sm">{suggestion.description}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>{formatDate(suggestion.created_at)}</span>
                              {isSuperAdmin && suggestion.submitter_name && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" /> {suggestion.submitter_name}
                                </span>
                              )}
                            </div>
                            {suggestion.hr_response && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-800">HR Response:</p>
                                <p className="text-sm text-blue-700">{suggestion.hr_response}</p>
                                <p className="text-xs text-blue-600 mt-1">
                                  - {suggestion.hr_responded_by_name} on {formatDate(suggestion.hr_responded_at)}
                                </p>
                              </div>
                            )}
                          </div>
                          {isHR && !suggestion.hr_response && (
                            <Button size="sm" variant="outline" onClick={() => setSelectedSuggestion(suggestion)}>
                              <MessageSquare className="w-4 h-4 mr-1" /> Respond
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No suggestions yet</p>
                  <p className="text-xs text-slate-400 mt-1">Be the first to share an idea!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SURVEYS TAB ==================== */}
        <TabsContent value="surveys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">
                    {isHR ? 'Survey Management' : 'My Surveys'}
                  </CardTitle>
                  <CardDescription>
                    {isHR ? 'Create and manage employee surveys' : 'Surveys assigned to you'}
                  </CardDescription>
                </div>
                {isHR && (
                  <Button onClick={() => setShowCreateSurvey(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Create Survey
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {surveys.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      {isHR && <TableHead>Responses</TableHead>}
                      <TableHead>Deadline</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.map((survey) => (
                      <TableRow key={survey.survey_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{survey.title}</p>
                            <p className="text-xs text-slate-500">{survey.description?.slice(0, 50)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge variant="outline">{survey.survey_type?.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(survey.status)}>
                            {survey.status}
                          </Badge>
                          {!isHR && survey.my_status && (
                            <Badge className={`ml-1 ${survey.my_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {survey.my_status}
                            </Badge>
                          )}
                        </TableCell>
                        {isHR && (
                          <TableCell>
                            <span className="font-medium">{survey.total_responses || 0}</span>
                            <span className="text-slate-400">/{survey.total_recipients || 0}</span>
                            <span className="text-xs text-slate-500 ml-1">
                              ({survey.response_rate || 0}%)
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-slate-500 text-sm">
                          {survey.end_date ? formatDate(survey.end_date) : 'No deadline'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {isHR ? (
                              <>
                                {survey.status === 'draft' && (
                                  <Button size="sm" variant="ghost" onClick={() => handleActivateSurvey(survey.survey_id)} title="Activate">
                                    <Play className="w-4 h-4 text-green-600" />
                                  </Button>
                                )}
                                {survey.status === 'active' && (
                                  <Button size="sm" variant="ghost" onClick={() => handleCloseSurvey(survey.survey_id)} title="Close">
                                    <X className="w-4 h-4 text-amber-600" />
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedSurvey(survey); fetchSurveyAnalytics(survey.survey_id); }} title="View Results">
                                  <BarChart3 className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDuplicateSurvey(survey.survey_id)} title="Duplicate">
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteSurvey(survey.survey_id)} title="Delete">
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              survey.status === 'active' && survey.my_status !== 'completed' && (
                                <Button size="sm" onClick={() => handleOpenSurveyToRespond(survey)}>
                                  <FileText className="w-4 h-4 mr-1" /> Take Survey
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{isHR ? 'No surveys created yet' : 'No surveys assigned to you'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== CREATE TICKET DIALOG ==================== */}
      <Dialog open={showCreateTicket} onOpenChange={setShowCreateTicket}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit a Complaint</DialogTitle>
            <DialogDescription>Report an issue or concern</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={ticketForm.category} onValueChange={(v) => setTicketForm({...ticketForm, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Query</SelectItem>
                    <SelectItem value="payroll">Payroll Issue</SelectItem>
                    <SelectItem value="leave">Leave Related</SelectItem>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="workplace">Workplace Concern</SelectItem>
                    <SelectItem value="benefits">Benefits & Insurance</SelectItem>
                    <SelectItem value="it_support">IT Support</SelectItem>
                    <SelectItem value="policy">Policy Clarification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm({...ticketForm, priority: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                placeholder="Brief description of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={ticketForm.description}
                onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                placeholder="Provide details..."
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={ticketForm.is_anonymous}
                onCheckedChange={(checked) => setTicketForm({...ticketForm, is_anonymous: checked})}
              />
              <Label className="text-sm">Submit anonymously</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
            <Button onClick={handleCreateTicket}>Submit Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== VIEW TICKET DIALOG ==================== */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ticket: {selectedTicket?.ticket_id}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-500">Category</Label>
                  <p className="capitalize">{selectedTicket.category?.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Priority</Label>
                  <Badge className={getPriorityBadge(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                </div>
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <Badge className={getStatusBadge(selectedTicket.status)}>{selectedTicket.status}</Badge>
                </div>
                <div>
                  <Label className="text-slate-500">Submitted</Label>
                  <p>{formatDate(selectedTicket.created_at)}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">Subject</Label>
                <p className="font-medium">{selectedTicket.subject}</p>
              </div>
              <div>
                <Label className="text-slate-500">Description</Label>
                <p className="text-slate-700">{selectedTicket.description}</p>
              </div>
              {selectedTicket.resolution && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <Label className="text-green-700">Resolution</Label>
                  <p className="text-green-800">{selectedTicket.resolution}</p>
                </div>
              )}
              {isHR && selectedTicket.status !== 'closed' && (
                <div className="flex gap-2 pt-4 border-t">
                  {selectedTicket.status === 'open' && (
                    <Button size="sm" onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, 'in_progress')}>
                      Mark In Progress
                    </Button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <Button size="sm" onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, 'resolved')}>
                      Mark Resolved
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, 'closed')}>
                    Close Ticket
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== CREATE SUGGESTION DIALOG ==================== */}
      <Dialog open={showCreateSuggestion} onOpenChange={setShowCreateSuggestion}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit a Suggestion</DialogTitle>
            <DialogDescription>Share your ideas to improve the workplace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={suggestionForm.category} onValueChange={(v) => setSuggestionForm({...suggestionForm, category: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="process">Process Improvement</SelectItem>
                  <SelectItem value="workplace">Workplace</SelectItem>
                  <SelectItem value="benefits">Benefits</SelectItem>
                  <SelectItem value="culture">Culture</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={suggestionForm.title}
                onChange={(e) => setSuggestionForm({...suggestionForm, title: e.target.value})}
                placeholder="Brief title for your suggestion"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={suggestionForm.description}
                onChange={(e) => setSuggestionForm({...suggestionForm, description: e.target.value})}
                placeholder="Explain your suggestion in detail..."
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={suggestionForm.is_anonymous}
                onCheckedChange={(checked) => setSuggestionForm({...suggestionForm, is_anonymous: checked})}
              />
              <Label className="text-sm">Submit anonymously (visible only to super admin)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSuggestion(false)}>Cancel</Button>
            <Button onClick={handleCreateSuggestion}>Submit Suggestion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== RESPOND TO SUGGESTION DIALOG ==================== */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to Suggestion</DialogTitle>
          </DialogHeader>
          {selectedSuggestion && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <h3 className="font-medium">{selectedSuggestion.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedSuggestion.description}</p>
              </div>
              <div className="space-y-2">
                <Label>Your Response</Label>
                <Textarea
                  value={suggestionResponse}
                  onChange={(e) => setSuggestionResponse(e.target.value)}
                  placeholder="Enter your response..."
                  rows={4}
                />
                <p className="text-xs text-slate-500">This response will only be visible to the submitter</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>Cancel</Button>
            <Button onClick={handleRespondToSuggestion}>Send Response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== CREATE SURVEY DIALOG ==================== */}
      <Dialog open={showCreateSurvey} onOpenChange={setShowCreateSurvey}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Survey</DialogTitle>
            <DialogDescription>Design and configure your survey</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Templates */}
            <div className="space-y-2">
              <Label>Start from Template (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {surveyTemplates.builtin_templates?.map((t) => (
                  <Button key={t.template_id} size="sm" variant="outline" onClick={() => loadTemplate(t)}>
                    {t.template_name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Survey Title *</Label>
                <Input
                  value={surveyForm.title}
                  onChange={(e) => setSurveyForm({...surveyForm, title: e.target.value})}
                  placeholder="e.g., Employee Satisfaction Survey Q1"
                />
              </div>
              <div className="space-y-2">
                <Label>Survey Type</Label>
                <Select value={surveyForm.survey_type} onValueChange={(v) => setSurveyForm({...surveyForm, survey_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poll">Poll</SelectItem>
                    <SelectItem value="text">Text Survey</SelectItem>
                    <SelectItem value="satisfaction">Satisfaction Survey</SelectItem>
                    <SelectItem value="engagement">Employee Engagement</SelectItem>
                    <SelectItem value="colleague_feedback">Colleague/360 Feedback</SelectItem>
                    <SelectItem value="pulse">Pulse Check</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={surveyForm.description}
                onChange={(e) => setSurveyForm({...surveyForm, description: e.target.value})}
                placeholder="Explain the purpose of this survey..."
                rows={2}
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={surveyForm.is_anonymous}
                  onCheckedChange={(checked) => setSurveyForm({...surveyForm, is_anonymous: checked})}
                />
                <Label className="text-sm">Anonymous responses</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={surveyForm.is_mandatory}
                  onCheckedChange={(checked) => setSurveyForm({...surveyForm, is_mandatory: checked})}
                />
                <Label className="text-sm">Mandatory</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={surveyForm.allow_edit}
                  onCheckedChange={(checked) => setSurveyForm({...surveyForm, allow_edit: checked})}
                />
                <Label className="text-sm">Allow editing responses</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={surveyForm.end_date}
                onChange={(e) => setSurveyForm({...surveyForm, end_date: e.target.value})}
              />
            </div>

            {/* Targeting */}
            <div className="space-y-3 p-4 border rounded-lg">
              <Label className="font-medium">Target Audience</Label>
              <Select value={surveyForm.target_type} onValueChange={(v) => setSurveyForm({...surveyForm, target_type: v, target_employees: [], target_departments: [], target_locations: []})}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="selected">Select Individuals</SelectItem>
                  <SelectItem value="department">By Department</SelectItem>
                  <SelectItem value="location">By Location</SelectItem>
                </SelectContent>
              </Select>

              {surveyForm.target_type === 'selected' && (
                <div className="space-y-2">
                  <Input
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto border rounded p-2">
                    {employees
                      .filter(e => 
                        employeeSearch === '' ||
                        `${e.first_name} ${e.last_name}`.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                        e.emp_code?.toLowerCase().includes(employeeSearch.toLowerCase())
                      )
                      .slice(0, 20)
                      .map(emp => (
                        <div key={emp.employee_id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={surveyForm.target_employees.includes(emp.employee_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSurveyForm({...surveyForm, target_employees: [...surveyForm.target_employees, emp.employee_id]});
                              } else {
                                setSurveyForm({...surveyForm, target_employees: surveyForm.target_employees.filter(id => id !== emp.employee_id)});
                              }
                            }}
                          />
                          <span className="text-sm">{emp.first_name} {emp.last_name} ({emp.emp_code})</span>
                        </div>
                      ))
                    }
                  </div>
                  <p className="text-xs text-slate-500">{surveyForm.target_employees.length} selected</p>
                </div>
              )}

              {surveyForm.target_type === 'department' && (
                <div className="flex flex-wrap gap-2">
                  {departments.map(dept => (
                    <Button
                      key={dept.department_id}
                      size="sm"
                      variant={surveyForm.target_departments.includes(dept.department_id) ? 'default' : 'outline'}
                      onClick={() => {
                        if (surveyForm.target_departments.includes(dept.department_id)) {
                          setSurveyForm({...surveyForm, target_departments: surveyForm.target_departments.filter(id => id !== dept.department_id)});
                        } else {
                          setSurveyForm({...surveyForm, target_departments: [...surveyForm.target_departments, dept.department_id]});
                        }
                      }}
                    >
                      <Building2 className="w-3 h-3 mr-1" /> {dept.name}
                    </Button>
                  ))}
                </div>
              )}

              {surveyForm.target_type === 'location' && (
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <Button
                      key={loc.location}
                      size="sm"
                      variant={surveyForm.target_locations.includes(loc.location) ? 'default' : 'outline'}
                      onClick={() => {
                        if (surveyForm.target_locations.includes(loc.location)) {
                          setSurveyForm({...surveyForm, target_locations: surveyForm.target_locations.filter(l => l !== loc.location)});
                        } else {
                          setSurveyForm({...surveyForm, target_locations: [...surveyForm.target_locations, loc.location]});
                        }
                      }}
                    >
                      <MapPin className="w-3 h-3 mr-1" /> {loc.location}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Questions */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="font-medium">Questions ({surveyForm.questions.length})</Label>
                <Button size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-1" /> Add Question
                </Button>
              </div>
              
              {surveyForm.questions.map((q, idx) => (
                <Card key={q.question_id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-500">Q{idx + 1}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeQuestion(idx)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-3">
                        <Input
                          value={q.text}
                          onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                          placeholder="Enter question text..."
                        />
                      </div>
                      <Select value={q.type} onValueChange={(v) => updateQuestion(idx, 'type', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rating">Rating (1-5)</SelectItem>
                          <SelectItem value="nps">NPS (0-10)</SelectItem>
                          <SelectItem value="single_choice">Single Choice</SelectItem>
                          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                          <SelectItem value="yes_no">Yes/No</SelectItem>
                          <SelectItem value="text">Short Text</SelectItem>
                          <SelectItem value="long_text">Long Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-1">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          value={q.options?.join(', ') || ''}
                          onChange={(e) => updateQuestion(idx, 'options', e.target.value.split(',').map(o => o.trim()))}
                          placeholder="Option 1, Option 2, Option 3..."
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {surveyForm.questions.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No questions added yet</p>
                  <p className="text-xs text-slate-400">Click "Add Question" or load a template</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateSurvey(false); resetSurveyForm(); }}>Cancel</Button>
            <Button onClick={handleCreateSurvey}>Create Survey (Draft)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== SURVEY ANALYTICS DIALOG ==================== */}
      <Dialog open={!!selectedSurvey && !!surveyAnalytics} onOpenChange={() => { setSelectedSurvey(null); setSurveyAnalytics(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey Results: {selectedSurvey?.title}</DialogTitle>
            <DialogDescription>
              {surveyAnalytics?.summary?.total_responses || 0} of {surveyAnalytics?.summary?.total_recipients || 0} responses ({surveyAnalytics?.summary?.response_rate || 0}%)
            </DialogDescription>
          </DialogHeader>
          {surveyAnalytics && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Total Recipients</p>
                  <p className="text-2xl font-bold">{surveyAnalytics.summary?.total_recipients || 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Responses</p>
                  <p className="text-2xl font-bold text-green-600">{surveyAnalytics.summary?.total_responses || 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Response Rate</p>
                  <p className="text-2xl font-bold">{surveyAnalytics.summary?.response_rate || 0}%</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={getStatusBadge(selectedSurvey?.status)}>{selectedSurvey?.status}</Badge>
                </Card>
              </div>

              {/* Question Analytics */}
              <div className="space-y-4">
                <h3 className="font-semibold">Question Breakdown</h3>
                {surveyAnalytics.question_analytics?.map((qa, idx) => (
                  <Card key={qa.question_id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <p className="font-medium">Q{idx + 1}: {qa.question_text}</p>
                        <Badge variant="outline">{qa.total_responses} responses</Badge>
                      </div>
                      
                      {qa.type === 'rating' || qa.type === 'nps' || qa.type === 'satisfaction' ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-500" />
                            <span className="text-2xl font-bold">{qa.analytics?.average || 0}</span>
                            <span className="text-slate-500">/ {qa.type === 'nps' ? 10 : 5}</span>
                          </div>
                          <div className="flex gap-1">
                            {Object.entries(qa.analytics?.distribution || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([rating, count]) => (
                              <div key={rating} className="text-center">
                                <div className="w-8 bg-slate-200 rounded-t" style={{ height: `${(count / qa.total_responses) * 60}px` }} />
                                <span className="text-xs">{rating}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : qa.type === 'single_choice' || qa.type === 'multiple_choice' || qa.type === 'yes_no' ? (
                        <div className="space-y-2">
                          {Object.entries(qa.analytics?.option_counts || {}).map(([option, count]) => (
                            <div key={option} className="flex items-center gap-3">
                              <div className="w-32 text-sm truncate">{option}</div>
                              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${(count / qa.total_responses) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-16 text-right">
                                {count} ({Math.round((count / qa.total_responses) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {qa.analytics?.responses?.slice(0, 10).map((resp, i) => (
                            <p key={i} className="text-sm p-2 bg-slate-50 rounded">"{resp}"</p>
                          ))}
                          {(qa.analytics?.responses?.length || 0) > 10 && (
                            <p className="text-xs text-slate-500">...and {qa.analytics.responses.length - 10} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== RESPOND TO SURVEY DIALOG (Employee) ==================== */}
      <Dialog open={showRespondSurvey} onOpenChange={setShowRespondSurvey}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{respondingSurvey?.title}</DialogTitle>
            <DialogDescription>{respondingSurvey?.description}</DialogDescription>
          </DialogHeader>
          {respondingSurvey && (
            <div className="space-y-6">
              {respondingSurvey.questions?.map((q, idx) => (
                <div key={q.question_id} className="space-y-2">
                  <Label className="font-medium">Q{idx + 1}: {q.text}</Label>
                  
                  {q.type === 'rating' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Button
                          key={n}
                          size="sm"
                          variant={surveyAnswers[q.question_id]?.rating === n ? 'default' : 'outline'}
                          onClick={() => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, rating: n }})}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'nps' && (
                    <div className="flex gap-1 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <Button
                          key={n}
                          size="sm"
                          variant={surveyAnswers[q.question_id]?.rating === n ? 'default' : 'outline'}
                          onClick={() => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, rating: n }})}
                          className="w-10"
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'yes_no' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={surveyAnswers[q.question_id]?.selected_options?.[0] === 'Yes' ? 'default' : 'outline'}
                        onClick={() => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, selected_options: ['Yes'] }})}
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" /> Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={surveyAnswers[q.question_id]?.selected_options?.[0] === 'No' ? 'default' : 'outline'}
                        onClick={() => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, selected_options: ['No'] }})}
                      >
                        No
                      </Button>
                    </div>
                  )}
                  
                  {q.type === 'single_choice' && (
                    <div className="space-y-1">
                      {q.options?.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={q.question_id}
                            checked={surveyAnswers[q.question_id]?.selected_options?.[0] === opt}
                            onChange={() => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, selected_options: [opt] }})}
                          />
                          <Label className="text-sm font-normal">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {q.options?.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            checked={surveyAnswers[q.question_id]?.selected_options?.includes(opt)}
                            onCheckedChange={(checked) => {
                              const current = surveyAnswers[q.question_id]?.selected_options || [];
                              const updated = checked
                                ? [...current, opt]
                                : current.filter(o => o !== opt);
                              setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, selected_options: updated }});
                            }}
                          />
                          <Label className="text-sm font-normal">{opt}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'text' && (
                    <Input
                      value={surveyAnswers[q.question_id]?.answer || ''}
                      onChange={(e) => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, answer: e.target.value }})}
                      placeholder="Your answer..."
                    />
                  )}
                  
                  {q.type === 'long_text' && (
                    <Textarea
                      value={surveyAnswers[q.question_id]?.answer || ''}
                      onChange={(e) => setSurveyAnswers({...surveyAnswers, [q.question_id]: { question_id: q.question_id, answer: e.target.value }})}
                      placeholder="Your answer..."
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRespondSurvey(false)}>Cancel</Button>
            <Button onClick={handleSubmitSurveyResponse}>
              <Send className="w-4 h-4 mr-1" /> Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpdeskPage;
