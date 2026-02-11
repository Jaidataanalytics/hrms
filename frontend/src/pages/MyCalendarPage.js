import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Users,
  Video,
  ListTodo,
  Flag,
  Trash2,
  Edit,
  RefreshCw,
  Sun,
  Briefcase,
  Home,
  Plane,
  X,
  AlertCircle
} from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Days of week
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

const MyCalendarPage = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [events, setEvents] = useState([]);
  
  // Dialog states
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [showDayDetailDialog, setShowDayDetailDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  
  // Form states
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'medium',
    assigned_to: ''
  });
  
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    participants: [],
    meeting_link: '',
    location: ''
  });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    fetchCalendarData();
  }, [currentMonth, currentYear]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      const [attRes, leaveRes, holidayRes, taskRes, meetingRes, empRes] = await Promise.all([
        fetch(`${API_URL}/attendance?month=${currentMonth + 1}&year=${currentYear}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/leave/my-leaves?year=${currentYear}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/holidays?year=${currentYear}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/calendar/tasks?month=${monthStr}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/calendar/meetings?month=${monthStr}`, { credentials: 'include', headers: authHeaders }),
        fetch(`${API_URL}/employees`, { credentials: 'include', headers: authHeaders })
      ]);

      if (attRes.ok) setAttendance(await attRes.json());
      if (leaveRes.ok) setLeaves(await leaveRes.json());
      if (holidayRes.ok) setHolidays(await holidayRes.json());
      if (taskRes.ok) setTasks(await taskRes.json());
      if (meetingRes.ok) setMeetings(await meetingRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar generation
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: prevMonthLastDay - i,
        isCurrentMonth: false,
        fullDate: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i)
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(currentYear, currentMonth, i)
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(currentYear, currentMonth + 1, i)
      });
    }
    
    return days;
  };

  const getDayData = (dateObj) => {
    const dateStr = dateObj.toISOString().split('T')[0];
    const dayOfWeek = dateObj.getDay();
    
    // Get attendance for this day
    const dayAttendance = attendance.find(a => a.date === dateStr);
    
    // Get leave for this day
    const dayLeave = leaves.find(l => {
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      return dateObj >= start && dateObj <= end;
    });
    
    // Get holiday
    const dayHoliday = holidays.find(h => h.date === dateStr);
    
    // Get tasks for this day
    const dayTasks = tasks.filter(t => t.due_date === dateStr);
    
    // Get meetings for this day
    const dayMeetings = meetings.filter(m => m.date === dateStr);
    
    return {
      dateStr,
      isSunday: dayOfWeek === 0,
      isToday: dateStr === new Date().toISOString().split('T')[0],
      attendance: dayAttendance,
      leave: dayLeave,
      holiday: dayHoliday,
      tasks: dayTasks,
      meetings: dayMeetings
    };
  };

  const getAttendanceColor = (dayData) => {
    if (dayData.holiday) return 'bg-purple-100 border-purple-300';
    if (dayData.isSunday) return 'bg-slate-100 border-slate-200';
    if (dayData.leave) {
      if (dayData.leave.status === 'approved') return 'bg-amber-100 border-amber-300';
      return 'bg-amber-50 border-amber-200';
    }
    if (dayData.attendance) {
      switch (dayData.attendance.status?.toLowerCase()) {
        case 'present': return dayData.attendance.is_late ? 'bg-yellow-100 border-yellow-300' : 'bg-emerald-100 border-emerald-300';
        case 'wfh': return 'bg-blue-100 border-blue-300';
        case 'absent': return 'bg-red-100 border-red-300';
        case 'half_day': return 'bg-orange-100 border-orange-300';
        case 'tour': return 'bg-indigo-100 border-indigo-300';
        default: return 'bg-white border-slate-200';
      }
    }
    return 'bg-white border-slate-200';
  };

  const getAttendanceIcon = (dayData) => {
    if (dayData.holiday) return <Sun className="w-3 h-3 text-purple-600" />;
    if (dayData.leave) return <Plane className="w-3 h-3 text-amber-600" />;
    if (dayData.attendance) {
      switch (dayData.attendance.status?.toLowerCase()) {
        case 'present': return <Briefcase className="w-3 h-3 text-emerald-600" />;
        case 'wfh': return <Home className="w-3 h-3 text-blue-600" />;
        case 'absent': return <X className="w-3 h-3 text-red-600" />;
        case 'tour': return <Plane className="w-3 h-3 text-indigo-600" />;
        default: return null;
      }
    }
    return null;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day) => {
    if (!day.isCurrentMonth) return;
    setSelectedDate(day.fullDate);
    setShowDayDetailDialog(true);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.due_date) {
      toast.error('Please fill title and due date');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const url = editingTask 
        ? `${API_URL}/calendar/tasks/${editingTask.task_id}`
        : `${API_URL}/calendar/tasks`;
      
      const response = await fetch(url, {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(taskForm)
      });

      if (response.ok) {
        toast.success(editingTask ? 'Task updated' : 'Task created');
        setShowTaskDialog(false);
        setEditingTask(null);
        setTaskForm({ title: '', description: '', due_date: '', due_time: '', priority: 'medium', assigned_to: '' });
        fetchCalendarData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to save task');
      }
    } catch (error) {
      toast.error('Failed to save task');
    }
  };

  const handleToggleTaskComplete = async (task) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/calendar/tasks/${task.task_id}/toggle`, {
        method: 'PUT',
        headers: { ...authHeaders },
        credentials: 'include'
      });

      if (response.ok) {
        fetchCalendarData();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/calendar/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Task deleted');
        fetchCalendarData();
      }
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.title || !meetingForm.date || !meetingForm.start_time) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const authHeaders = getAuthHeaders();
      const url = editingMeeting 
        ? `${API_URL}/calendar/meetings/${editingMeeting.meeting_id}`
        : `${API_URL}/calendar/meetings`;
      
      const response = await fetch(url, {
        method: editingMeeting ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify(meetingForm)
      });

      if (response.ok) {
        toast.success(editingMeeting ? 'Meeting updated' : 'Meeting scheduled');
        setShowMeetingDialog(false);
        setEditingMeeting(null);
        setMeetingForm({ title: '', description: '', date: '', start_time: '', end_time: '', participants: [], meeting_link: '', location: '' });
        fetchCalendarData();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to save meeting');
      }
    } catch (error) {
      toast.error('Failed to save meeting');
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch(`${API_URL}/calendar/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Meeting cancelled');
        fetchCalendarData();
      }
    } catch (error) {
      toast.error('Failed to cancel meeting');
    }
  };

  const openNewTask = (date = null) => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      due_date: date || new Date().toISOString().split('T')[0],
      due_time: '',
      priority: 'medium',
      assigned_to: ''
    });
    setShowTaskDialog(true);
  };

  const openNewMeeting = (date = null) => {
    setEditingMeeting(null);
    setMeetingForm({
      title: '',
      description: '',
      date: date || new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      participants: [],
      meeting_link: '',
      location: ''
    });
    setShowMeetingDialog(true);
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.employee_id === empId);
    return emp ? `${emp.first_name} ${emp.last_name}` : empId;
  };

  const calendarDays = generateCalendarDays();

  // Calculate monthly summary
  const monthlyStats = {
    present: attendance.filter(a => a.status === 'present').length,
    wfh: attendance.filter(a => a.status === 'wfh').length,
    leave: leaves.filter(l => {
      const start = new Date(l.start_date);
      return start.getMonth() === currentMonth && start.getFullYear() === currentYear && l.status === 'approved';
    }).length,
    late: attendance.filter(a => a.is_late).length,
    tasks: tasks.length,
    meetings: meetings.length
  };

  return (
    <div className="space-y-6" data-testid="my-calendar-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Calendar</h1>
          <p className="text-slate-600 mt-1">View attendance, manage tasks, and schedule meetings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewTask()}>
            <ListTodo className="w-4 h-4 mr-2" />
            Add Task
          </Button>
          <Button onClick={() => openNewMeeting()}>
            <Video className="w-4 h-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{monthlyStats.present}</p>
            <p className="text-xs text-emerald-600">Present</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{monthlyStats.wfh}</p>
            <p className="text-xs text-blue-600">WFH</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{monthlyStats.leave}</p>
            <p className="text-xs text-amber-600">Leave</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-700">{monthlyStats.late}</p>
            <p className="text-xs text-yellow-600">Late</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-purple-700">{monthlyStats.tasks}</p>
            <p className="text-xs text-purple-600">Tasks</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-indigo-700">{monthlyStats.meetings}</p>
            <p className="text-xs text-indigo-600">Meetings</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-xl font-semibold min-w-[180px] text-center">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
            </div>
            
            {/* Legend */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200"></div> Present</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200"></div> WFH</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-200"></div> Leave</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-200"></div> Holiday</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200"></div> Absent</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {DAYS.map(day => (
                <div key={day} className={`text-center py-2 text-sm font-semibold ${day === 'Sun' ? 'text-red-500' : 'text-slate-600'}`}>
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, idx) => {
                const dayData = getDayData(day.fullDate);
                const bgColor = day.isCurrentMonth ? getAttendanceColor(dayData) : 'bg-slate-50';
                
                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] p-1 border rounded-lg cursor-pointer transition-all hover:shadow-md ${bgColor} ${
                      !day.isCurrentMonth ? 'opacity-40' : ''
                    } ${dayData.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    data-testid={`calendar-day-${dayData.dateStr}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold ${dayData.isSunday ? 'text-red-500' : ''}`}>
                        {day.date}
                      </span>
                      {getAttendanceIcon(dayData)}
                    </div>
                    
                    {/* Day content */}
                    {day.isCurrentMonth && (
                      <div className="space-y-0.5">
                        {dayData.holiday && (
                          <div className="text-[10px] text-purple-700 truncate" title={dayData.holiday.name}>
                            🎉 {dayData.holiday.name}
                          </div>
                        )}
                        {dayData.leave && (
                          <div className="text-[10px] text-amber-700 truncate">
                            ✈️ {dayData.leave.leave_type || 'Leave'}
                          </div>
                        )}
                        {dayData.attendance && dayData.attendance.first_in && (
                          <div className="text-[10px] text-slate-500">
                            {dayData.attendance.first_in}
                          </div>
                        )}
                        {dayData.tasks.slice(0, 2).map((task, i) => (
                          <div key={i} className={`text-[10px] truncate flex items-center gap-0.5 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            <ListTodo className="w-2 h-2" />
                            {task.title}
                          </div>
                        ))}
                        {dayData.meetings.slice(0, 1).map((meeting, i) => (
                          <div key={i} className="text-[10px] text-indigo-700 truncate flex items-center gap-0.5">
                            <Video className="w-2 h-2" />
                            {meeting.start_time} {meeting.title}
                          </div>
                        ))}
                        {(dayData.tasks.length > 2 || dayData.meetings.length > 1) && (
                          <div className="text-[10px] text-slate-400">
                            +{dayData.tasks.length - 2 + dayData.meetings.length - 1} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Tasks & Meetings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-purple-600" />
                My Tasks
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => openNewTask()}>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {tasks.length > 0 ? tasks.slice(0, 10).map(task => (
              <div key={task.task_id} className={`p-3 rounded-lg border ${task.completed ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex items-start gap-2">
                  <Checkbox 
                    checked={task.completed}
                    onCheckedChange={() => handleToggleTaskComplete(task)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${task.completed ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{task.due_date}</span>
                      <Badge variant="outline" className={`text-xs ${
                        task.priority === 'high' ? 'border-red-300 text-red-600' :
                        task.priority === 'low' ? 'border-slate-300 text-slate-500' :
                        'border-amber-300 text-amber-600'
                      }`}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteTask(task.task_id)}>
                    <Trash2 className="w-3 h-3 text-slate-400" />
                  </Button>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400">
                <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No tasks yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meetings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-600" />
                My Meetings
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => openNewMeeting()}>
                <Plus className="w-3 h-3 mr-1" />
                Schedule
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {meetings.length > 0 ? meetings.slice(0, 10).map(meeting => (
              <div key={meeting.meeting_id} className="p-3 rounded-lg border bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{meeting.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <CalendarIcon className="w-3 h-3" />
                      {meeting.date}
                      <Clock className="w-3 h-3 ml-2" />
                      {meeting.start_time} - {meeting.end_time || '?'}
                    </div>
                    {meeting.participants?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Users className="w-3 h-3" />
                        {meeting.participants.length} participants
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {meeting.meeting_link && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                        <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                          <Video className="w-3 h-3 mr-1" />
                          Join
                        </a>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteMeeting(meeting.meeting_id)}>
                      <Trash2 className="w-3 h-3 text-slate-400" />
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400">
                <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No meetings scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={showDayDetailDialog} onOpenChange={setShowDayDetailDialog}>
        <DialogContent className="max-w-lg">
          {selectedDate && (() => {
            const dayData = getDayData(selectedDate);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Attendance */}
                  {dayData.attendance && (
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-sm font-medium mb-2">Attendance</p>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge>{dayData.attendance.status}</Badge>
                        {dayData.attendance.first_in && <span>In: {dayData.attendance.first_in}</span>}
                        {dayData.attendance.last_out && <span>Out: {dayData.attendance.last_out}</span>}
                        {dayData.attendance.is_late && <Badge variant="destructive">Late</Badge>}
                      </div>
                    </div>
                  )}
                  
                  {dayData.holiday && (
                    <div className="p-3 rounded-lg bg-purple-50">
                      <p className="text-sm font-medium text-purple-800">🎉 {dayData.holiday.name}</p>
                    </div>
                  )}
                  
                  {dayData.leave && (
                    <div className="p-3 rounded-lg bg-amber-50">
                      <p className="text-sm font-medium text-amber-800">
                        ✈️ {dayData.leave.leave_type || 'Leave'} - {dayData.leave.status}
                      </p>
                    </div>
                  )}
                  
                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Tasks</p>
                      <Button size="sm" variant="ghost" onClick={() => { setShowDayDetailDialog(false); openNewTask(dayData.dateStr); }}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {dayData.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {dayData.tasks.map(task => (
                          <div key={task.task_id} className="flex items-center gap-2 p-2 rounded bg-slate-50">
                            <Checkbox checked={task.completed} onCheckedChange={() => handleToggleTaskComplete(task)} />
                            <span className={`text-sm flex-1 ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No tasks</p>
                    )}
                  </div>
                  
                  {/* Meetings */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Meetings</p>
                      <Button size="sm" variant="ghost" onClick={() => { setShowDayDetailDialog(false); openNewMeeting(dayData.dateStr); }}>
                        <Plus className="w-3 h-3 mr-1" />
                        Schedule
                      </Button>
                    </div>
                    {dayData.meetings.length > 0 ? (
                      <div className="space-y-2">
                        {dayData.meetings.map(meeting => (
                          <div key={meeting.meeting_id} className="p-2 rounded bg-indigo-50">
                            <p className="text-sm font-medium text-indigo-800">{meeting.title}</p>
                            <p className="text-xs text-indigo-600">{meeting.start_time} - {meeting.end_time}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No meetings</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>Add a task to your calendar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={taskForm.due_time}
                  onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign To (Optional)</Label>
                <Select value={taskForm.assigned_to || "self"} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v === "self" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Self" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    {employees.slice(0, 50).map(emp => (
                      <SelectItem key={emp.employee_id} value={emp.employee_id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTask}>
              {editingTask ? 'Update' : 'Create'} Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
            <DialogDescription>Create a meeting and invite participants</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                placeholder="Meeting title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={meetingForm.description}
                onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                placeholder="Meeting agenda"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={meetingForm.date}
                  onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={meetingForm.start_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={meetingForm.end_time}
                  onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meeting Link (Teams/Zoom)</Label>
              <Input
                value={meetingForm.meeting_link}
                onChange={(e) => setMeetingForm({ ...meetingForm, meeting_link: e.target.value })}
                placeholder="https://teams.microsoft.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Location (Optional)</Label>
              <Input
                value={meetingForm.location}
                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                placeholder="Conference Room / Online"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateMeeting}>
              <Video className="w-4 h-4 mr-2" />
              {editingMeeting ? 'Update' : 'Schedule'} Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyCalendarPage;
