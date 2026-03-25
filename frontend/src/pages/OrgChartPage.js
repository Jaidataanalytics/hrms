import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Search, ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronRight,
  Users, Building2, Mail, Phone, User
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OrgNode = ({ node, depth = 0, searchTerm, expandedNodes, toggleNode }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children?.length > 0;
  const matchesSearch = searchTerm && node.name?.toLowerCase().includes(searchTerm.toLowerCase());
  const initials = node.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const depthColors = [
    { bg: 'bg-blue-600', light: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    { bg: 'bg-indigo-600', light: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
    { bg: 'bg-violet-600', light: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
    { bg: 'bg-slate-600', light: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
  ];
  const color = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div className="org-node-wrapper" data-testid={`org-node-${node.id}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: depth * 0.03 }}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
          matchesSearch ? 'ring-2 ring-amber-400 bg-amber-50 border-amber-200' : `${color.light}`
        }`}
        onClick={() => hasChildren && toggleNode(node.id)}
      >
        {/* Expand/collapse toggle */}
        <div className="w-5 shrink-0">
          {hasChildren ? (
            <button className="text-slate-400 hover:text-slate-700 transition-colors" data-testid={`toggle-${node.id}`}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : <div className="w-4" />}
        </div>

        {/* Avatar */}
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarFallback className={`${color.bg} text-white text-xs font-bold`}>
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{node.name}</p>
          <p className="text-xs text-slate-500 truncate">{node.designation || 'No designation'}</p>
        </div>

        {/* Department badge */}
        {node.department && (
          <Badge variant="outline" className={`text-xs shrink-0 ${color.text} border-current/20`}>
            {node.department}
          </Badge>
        )}

        {/* Child count */}
        {hasChildren && (
          <span className="text-xs text-slate-400 shrink-0">
            {node.children.length} report{node.children.length !== 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-8 mt-1 space-y-1 relative">
          <div className="absolute left-0 top-0 bottom-3 w-px bg-slate-200" style={{ marginLeft: '-12px' }} />
          {node.children
            .sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))
            .map(child => (
              <OrgNode
                key={child.id}
                node={child}
                depth={depth + 1}
                searchTerm={searchTerm}
                expandedNodes={expandedNodes}
                toggleNode={toggleNode}
              />
            ))}
        </div>
      )}
    </div>
  );
};

const OrgChartPage = () => {
  const { user } = useAuth();
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const fetchOrgChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/org-chart`, {
        headers: getAuthHeaders(), 
      });
      if (res.ok) {
        const data = await res.json();
        setOrgData(data);
        // Auto-expand first 2 levels
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
    } catch (err) {
      toast.error('Failed to load org chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgChart(); }, [fetchOrgChart]);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set();
    const collectIds = (nodes) => {
      nodes.forEach(n => {
        if (n.children?.length > 0) { all.add(n.id); collectIds(n.children); }
      });
    };
    collectIds(orgData?.roots || []);
    setExpandedNodes(all);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  // Count total nodes for stats
  const countNodes = (nodes) => {
    let count = 0;
    nodes.forEach(n => { count += 1 + countNodes(n.children || []); });
    return count;
  };

  // Gather unique departments
  const getDepartments = (nodes) => {
    const depts = new Set();
    const collect = (items) => {
      items.forEach(n => { if (n.department) depts.add(n.department); collect(n.children || []); });
    };
    collect(nodes);
    return depts;
  };

  // Filter nodes by search
  const filterNodes = (nodes, term) => {
    if (!term) return nodes;
    const lower = term.toLowerCase();
    const filter = (items) => {
      return items.reduce((acc, node) => {
        const childMatches = filter(node.children || []);
        const selfMatches = node.name?.toLowerCase().includes(lower) ||
          node.designation?.toLowerCase().includes(lower) ||
          node.department?.toLowerCase().includes(lower);
        if (selfMatches || childMatches.length > 0) {
          acc.push({ ...node, children: childMatches.length > 0 ? childMatches : node.children });
        }
        return acc;
      }, []);
    };
    return filter(nodes);
  };

  // Auto-expand matching nodes on search
  useEffect(() => {
    if (!searchTerm || !orgData) return;
    const lower = searchTerm.toLowerCase();
    const matched = new Set();
    const findParents = (nodes, parentIds = []) => {
      nodes.forEach(n => {
        const current = [...parentIds, n.id];
        if (n.name?.toLowerCase().includes(lower) ||
            n.designation?.toLowerCase().includes(lower) ||
            n.department?.toLowerCase().includes(lower)) {
          current.forEach(id => matched.add(id));
        }
        findParents(n.children || [], current);
      });
    };
    findParents(orgData.roots || []);
    if (matched.size > 0) setExpandedNodes(prev => new Set([...prev, ...matched]));
  }, [searchTerm, orgData]);

  const roots = orgData?.roots || [];
  const filteredRoots = filterNodes(roots, searchTerm);
  const departments = getDepartments(roots);

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
          <p className="text-slate-500 text-sm mt-1">Interactive team hierarchy and reporting structure</p>
          <div className="header-accent-line mt-3 max-w-[200px]" />
        </div>
      </motion.div>

      {/* Stats bar */}
      {orgData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{orgData.total_employees}</p>
                <p className="text-xs text-slate-500">Total Employees</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{departments.size}</p>
                <p className="text-xs text-slate-500">Departments</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <User className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{roots.length}</p>
                <p className="text-xs text-slate-500">Top Leaders</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <ChevronDown className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{expandedNodes.size}</p>
                <p className="text-xs text-slate-500">Branches Open</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search & Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, role, or department..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="org-search-input"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} data-testid="expand-all-btn">
                <ZoomIn className="w-4 h-4 mr-1" /> Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} data-testid="collapse-all-btn">
                <ZoomOut className="w-4 h-4 mr-1" /> Collapse All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Org Tree */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 skeleton rounded-xl" style={{ marginLeft: `${i * 20}px`, width: `calc(100% - ${i * 20}px)` }} />
              ))}
            </div>
          ) : filteredRoots.length > 0 ? (
            <div className="space-y-1">
              {filteredRoots.map(root => (
                <OrgNode
                  key={root.id}
                  node={root}
                  depth={0}
                  searchTerm={searchTerm}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500">
                {searchTerm ? `No employees matching "${searchTerm}"` : 'No organization data available'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrgChartPage;
