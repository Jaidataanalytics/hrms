import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ZoomIn, ZoomOut, ChevronDown, ChevronRight,
  Users, Building2, Mail, Phone, User, Briefcase, MapPin
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DEPTH_PALETTE = [
  { ring: 'ring-blue-500/30', bg: 'bg-gradient-to-br from-blue-500 to-blue-600', card: 'border-blue-200/60 bg-blue-50/40', badge: 'bg-blue-100 text-blue-700', line: 'bg-blue-300' },
  { ring: 'ring-indigo-500/30', bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600', card: 'border-indigo-200/60 bg-indigo-50/30', badge: 'bg-indigo-100 text-indigo-700', line: 'bg-indigo-300' },
  { ring: 'ring-violet-500/30', bg: 'bg-gradient-to-br from-violet-500 to-violet-600', card: 'border-violet-200/60 bg-violet-50/30', badge: 'bg-violet-100 text-violet-700', line: 'bg-violet-300' },
  { ring: 'ring-emerald-500/30', bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', card: 'border-emerald-200/60 bg-emerald-50/30', badge: 'bg-emerald-100 text-emerald-700', line: 'bg-emerald-300' },
  { ring: 'ring-amber-500/30', bg: 'bg-gradient-to-br from-amber-500 to-amber-600', card: 'border-amber-200/60 bg-amber-50/30', badge: 'bg-amber-100 text-amber-700', line: 'bg-amber-300' },
];

const OrgNode = ({ node, depth = 0, searchTerm, expandedNodes, toggleNode, selectedNode, setSelectedNode, index = 0 }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children?.length > 0;
  const isSelected = selectedNode === node.id;
  const matchesSearch = searchTerm && (
    node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const initials = node.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const palette = DEPTH_PALETTE[Math.min(depth, DEPTH_PALETTE.length - 1)];

  return (
    <div className="relative" data-testid={`org-node-${node.id}`}>
      {/* Vertical connector line from parent */}
      {depth > 0 && (
        <div className={`absolute -left-6 top-0 bottom-0 w-0.5 ${palette.line} opacity-40`} />
      )}

      {/* Horizontal connector line */}
      {depth > 0 && (
        <div className={`absolute -left-6 top-7 w-6 h-0.5 ${palette.line} opacity-40`} />
      )}

      <motion.div
        initial={{ opacity: 0, x: -16, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: [0.4, 0, 0.2, 1] }}
        className={`relative group rounded-xl border p-3 transition-all duration-200 cursor-pointer
          ${matchesSearch ? 'ring-2 ring-amber-400 bg-amber-50/60 border-amber-300 shadow-amber-100' : 
            isSelected ? `ring-2 ${palette.ring} shadow-lg ${palette.card}` : 
            `${palette.card} hover:shadow-md hover:border-opacity-80`}`}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNode(isSelected ? null : node.id);
        }}
      >
        <div className="flex items-center gap-3">
          {/* Expand toggle */}
          <div className="w-5 shrink-0 flex items-center justify-center">
            {hasChildren ? (
              <button 
                className="w-5 h-5 rounded-md flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                data-testid={`toggle-${node.id}`}
              >
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </motion.div>
              </button>
            ) : <div className="w-3 h-3 rounded-full bg-slate-200/60" />}
          </div>

          {/* Avatar */}
          <Avatar className={`w-10 h-10 shrink-0 ring-2 ${palette.ring} shadow-sm`}>
            <AvatarFallback className={`${palette.bg} text-white text-xs font-bold`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name & role */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate leading-tight">{node.name}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{node.designation || 'Team Member'}</p>
          </div>

          {/* Department */}
          {node.department && (
            <Badge className={`text-[10px] font-medium shrink-0 ${palette.badge} border-0 px-2 py-0.5`}>
              {node.department}
            </Badge>
          )}

          {/* Reports count */}
          {hasChildren && (
            <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0 bg-slate-100 px-2 py-1 rounded-full">
              <Users className="w-3 h-3" />
              <span>{node.children.length}</span>
            </div>
          )}
        </div>

        {/* Expanded details panel */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {node.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{node.email}</span>
                  </div>
                )}
                {node.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{node.phone}</span>
                  </div>
                )}
                {node.emp_code && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>{node.emp_code}</span>
                  </div>
                )}
                {node.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{node.location}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Children with connecting lines */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="ml-6 mt-1.5 space-y-1.5 relative overflow-hidden"
          >
            {node.children
              .sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))
              .map((child, i) => (
                <OrgNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  searchTerm={searchTerm}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  selectedNode={selectedNode}
                  setSelectedNode={setSelectedNode}
                  index={i}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const OrgChartPage = () => {
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const searchRef = useRef(null);

  const fetchOrgChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/org-chart`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOrgData(data);
        const initialExpanded = new Set();
        const expandLevel = (nodes, level) => {
          if (level > 1) return;
          nodes.forEach(n => {
            if (n.children?.length > 0) {
              initialExpanded.add(n.id);
              expandLevel(n.children, level + 1);
            }
          });
        };
        expandLevel(data.roots || [], 0);
        setExpandedNodes(initialExpanded);
      }
    } catch {
      toast.error('Failed to load org chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgChart(); }, [fetchOrgChart]);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set();
    const collect = (nodes) => nodes.forEach(n => {
      if (n.children?.length > 0) { all.add(n.id); collect(n.children); }
    });
    collect(orgData?.roots || []);
    setExpandedNodes(all);
  };

  const collapseAll = () => { setExpandedNodes(new Set()); setSelectedNode(null); };

  const getDepartments = (nodes) => {
    const depts = new Set();
    const collect = (items) => items.forEach(n => { if (n.department) depts.add(n.department); collect(n.children || []); });
    collect(nodes);
    return depts;
  };

  useEffect(() => {
    if (!searchTerm || !orgData) return;
    const lower = searchTerm.toLowerCase();
    const matched = new Set();
    const findParents = (nodes, parentIds = []) => {
      nodes.forEach(n => {
        const current = [...parentIds, n.id];
        if (n.name?.toLowerCase().includes(lower) || n.designation?.toLowerCase().includes(lower) || n.department?.toLowerCase().includes(lower)) {
          current.forEach(id => matched.add(id));
        }
        findParents(n.children || [], current);
      });
    };
    findParents(orgData.roots || []);
    if (matched.size > 0) setExpandedNodes(prev => new Set([...prev, ...matched]));
  }, [searchTerm, orgData]);

  const filterNodes = (nodes, term) => {
    if (!term) return nodes;
    const lower = term.toLowerCase();
    const filter = (items) => items.reduce((acc, node) => {
      const childMatches = filter(node.children || []);
      const selfMatches = node.name?.toLowerCase().includes(lower) || node.designation?.toLowerCase().includes(lower) || node.department?.toLowerCase().includes(lower);
      if (selfMatches || childMatches.length > 0) acc.push({ ...node, children: childMatches.length > 0 ? childMatches : node.children });
      return acc;
    }, []);
    return filter(nodes);
  };

  const roots = orgData?.roots || [];
  const filteredRoots = filterNodes(roots, searchTerm);
  const departments = getDepartments(roots);
  const totalEmployees = orgData?.total_employees || 0;

  return (
    <div className="space-y-6" data-testid="org-chart-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="section-pill mono-accent">// ORG CHART</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Organization Structure
          </h1>
          <p className="text-slate-500 text-sm mt-1">Interactive team hierarchy and reporting lines</p>
          <div className="header-accent-line mt-3 max-w-[200px]" />
        </div>
      </motion.div>

      {/* Stats */}
      {orgData && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, color: 'blue', value: totalEmployees, label: 'Team Members' },
            { icon: Building2, color: 'indigo', value: departments.size, label: 'Departments' },
            { icon: User, color: 'emerald', value: roots.length, label: 'Top Leaders' },
            { icon: ChevronDown, color: 'violet', value: expandedNodes.size, label: 'Branches Open' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Card className="p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg bg-${s.color}-100 flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 text-${s.color}-600`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 leading-tight">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Search & Controls */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  ref={searchRef}
                  placeholder="Search by name, role, or department..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="org-search-input"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={expandAll} data-testid="expand-all-btn" className="gap-1.5">
                  <ZoomIn className="w-4 h-4" /> Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} data-testid="collapse-all-btn" className="gap-1.5">
                  <ZoomOut className="w-4 h-4" /> Collapse
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Org Tree */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardContent className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={`skel-${i}`} className="h-14 skeleton rounded-xl" style={{ marginLeft: `${i * 24}px`, width: `calc(100% - ${i * 24}px)` }} />
                ))}
              </div>
            ) : filteredRoots.length > 0 ? (
              <div className="space-y-2">
                {filteredRoots.map((root, i) => (
                  <OrgNode
                    key={root.id}
                    node={root}
                    depth={0}
                    searchTerm={searchTerm}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                    selectedNode={selectedNode}
                    setSelectedNode={setSelectedNode}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">
                  {searchTerm ? `No results for "${searchTerm}"` : 'No organization data available'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchTerm ? 'Try a different search term' : 'Add employees with reporting managers to build the chart'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default OrgChartPage;
