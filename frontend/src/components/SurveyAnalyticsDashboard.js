import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Star, Download, BarChart3, Users, CheckCircle2, Clock, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const SurveyAnalyticsDashboard = ({ surveyId, isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && surveyId) fetchAnalytics();
  }, [isOpen, surveyId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/helpdesk/surveys/${surveyId}/analytics/detailed`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (res.ok) setData(await res.json());
      else toast.error('Failed to load analytics');
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/helpdesk/surveys/${surveyId}/export`, '_blank');
  };

  if (!isOpen) return null;

  const barColors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{data?.survey?.title || 'Survey Analytics'}</DialogTitle>
              <p className="text-sm text-slate-500 mt-1">{data?.survey?.description}</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="export-survey-btn">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-6 mt-2">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Recipients', value: data.summary?.total_recipients || 0, icon: Users, color: 'blue' },
                { label: 'Responses', value: data.summary?.total_responses || 0, icon: CheckCircle2, color: 'emerald' },
                { label: 'Response Rate', value: `${data.summary?.response_rate || 0}%`, icon: BarChart3, color: 'amber' },
                { label: 'Overall Score', value: data.summary?.overall_score ? `${data.summary.overall_score}/5` : 'N/A', icon: Star, color: 'purple' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <div className={`premium-stat stat-${s.color}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-500">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{s.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Response Rate Gauge */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24">
                    <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                      <circle cx="50" cy="50" r="40" stroke="hsl(220 14% 95%)" strokeWidth="8" fill="none" />
                      <motion.circle cx="50" cy="50" r="40" stroke="hsl(243 75% 49%)" strokeWidth="8" fill="none"
                        strokeDasharray={`${(data.summary?.response_rate || 0) / 100 * 251.2} 251.2`}
                        strokeLinecap="round" initial={{ strokeDasharray: '0 251.2' }}
                        animate={{ strokeDasharray: `${(data.summary?.response_rate || 0) / 100 * 251.2} 251.2` }}
                        transition={{ duration: 1, ease: 'easeOut' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{data.summary?.response_rate || 0}%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-2">Response Rate</h4>
                    <p className="text-xs text-slate-500">
                      {data.summary?.total_responses} of {data.summary?.total_recipients} responded
                    </p>
                    {data.summary?.started && (
                      <p className="text-xs text-slate-400 mt-1">Started: {new Date(data.summary.started).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Department Breakdown */}
            {Object.keys(data.department_breakdown || {}).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Department Response Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data.department_breakdown).sort((a, b) => b[1].count - a[1].count).map(([dept, info], i) => (
                    <div key={dept} className="flex items-center gap-3">
                      <span className="text-sm w-28 truncate font-medium">{dept}</span>
                      <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                        <motion.div className={`h-full ${barColors[i % barColors.length]} rounded-lg flex items-center px-2`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max((info.count / (data.summary?.total_responses || 1)) * 100, 8)}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}>
                          <span className="text-xs font-bold text-white">{info.count}</span>
                        </motion.div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Question Analytics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Question Breakdown</h3>
              {data.question_analytics?.map((qa, idx) => (
                <Card key={qa.question_id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm flex-1">Q{idx + 1}: {qa.question_text}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{qa.total_responses} responses</Badge>
                    </div>

                    {(qa.type === 'rating' || qa.type === 'nps' || qa.type === 'satisfaction') && qa.analytics?.average ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                            <span className="text-2xl font-bold">{qa.analytics.average}</span>
                            <span className="text-slate-400 text-sm">/ {qa.type === 'nps' ? 10 : 5}</span>
                          </div>
                        </div>
                        {/* Bar Distribution */}
                        <div className="flex items-end gap-1.5 h-16">
                          {Object.entries(qa.analytics.distribution || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([rating, count]) => {
                            const pct = qa.total_responses > 0 ? (count / qa.total_responses) * 100 : 0;
                            return (
                              <div key={rating} className="flex-1 flex flex-col items-center gap-1">
                                <motion.div className="w-full bg-primary/80 rounded-t-md" style={{ minHeight: 4 }}
                                  initial={{ height: 4 }} animate={{ height: `${Math.max(pct * 0.6, 4)}px` }}
                                  transition={{ duration: 0.5, delay: Number(rating) * 0.05 }} />
                                <span className="text-[10px] font-semibold text-slate-500">{rating}</span>
                                <span className="text-[9px] text-slate-400">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Department breakdown for rating */}
                        {Object.keys(qa.dept_breakdown || {}).length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-slate-400 mb-1.5">By Department</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(qa.dept_breakdown).sort((a, b) => b[1] - a[1]).map(([dept, avg]) => (
                                <span key={dept} className="text-xs px-2 py-1 bg-slate-50 rounded-md border">
                                  {dept}: <strong>{avg}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : qa.type === 'single_choice' || qa.type === 'multiple_choice' || qa.type === 'yes_no' ? (
                      <div className="space-y-2">
                        {Object.entries(qa.analytics?.option_counts || {}).sort((a, b) => b[1] - a[1]).map(([option, count], i) => {
                          const pct = qa.total_responses > 0 ? Math.round((count / qa.total_responses) * 100) : 0;
                          return (
                            <div key={option} className="flex items-center gap-3">
                              <span className="text-sm w-28 truncate">{option}</span>
                              <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                                <motion.div className={`h-full ${barColors[i % barColors.length]} rounded-lg`}
                                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5, delay: i * 0.05 }} />
                              </div>
                              <span className="text-xs font-semibold w-14 text-right">{count} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {qa.analytics?.responses?.slice(0, 8).map((resp, i) => (
                          <p key={i} className="text-sm p-2 bg-slate-50 rounded-lg border border-slate-100 italic">"{resp}"</p>
                        ))}
                        {(qa.analytics?.total_text || qa.analytics?.responses?.length || 0) > 8 && (
                          <p className="text-xs text-slate-400 text-center">+{(qa.analytics?.total_text || qa.analytics?.responses?.length) - 8} more responses</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Response Timeline */}
            {Object.keys(data.response_timeline || {}).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Response Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-20">
                    {Object.entries(data.response_timeline).map(([day, count], i) => {
                      const maxCount = Math.max(...Object.values(data.response_timeline));
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${count} responses`}>
                          <motion.div className="w-full bg-primary/70 rounded-t"
                            initial={{ height: 0 }} animate={{ height: `${Math.max(pct * 0.6, 4)}px` }}
                            transition={{ duration: 0.4, delay: i * 0.03 }} />
                          <span className="text-[9px] text-slate-400 -rotate-45 origin-top-left whitespace-nowrap">
                            {new Date(day).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default SurveyAnalyticsDashboard;
