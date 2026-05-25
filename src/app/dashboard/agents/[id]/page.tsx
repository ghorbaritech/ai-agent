'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { supabase } from '@/lib/supabaseClient';
import { WeeklyReportView } from '@/components/WeeklyReportView';
import { 
  Activity, Zap, Shield, BarChart3, BookOpen, Clock, 
  Play, RotateCcw, Cpu, CheckCircle2, Loader2, Send, 
  Paperclip, Image as ImageIcon, FileText, ListTodo, Settings as SettingsIcon, 
  Database, LineChart, BrainCircuit, Globe, Layout, ChevronDown,
  MessageSquare, Calculator, Gavel, UserSearch, UserPlus, Package, Palette, TrendingUp, Share2, ShieldCheck, DollarSign, Calendar,
  Plus, Filter, MoreHorizontal, ArrowRight, MousePointer2, GitBranch, Terminal, MapPin, Bell,
  Paperclip as AttachmentIcon, X, Target, Info, Copy, ExternalLink, Search, Eye, Cloud
} from 'lucide-react';
import { DefaultChatTransport } from 'ai';

const configTabs = ['Settings', 'Memory', 'Tools', 'Interface', 'Integrations'];

const allSources = [
  { name: 'Google Calendar', icon: Calendar, desc: 'Sync events and availability', category: 'Productivity' },
  { name: 'Gmail', icon: Globe, desc: 'Monitor and draft email communications', category: 'Communication' },
  { name: 'Microsoft Outlook', icon: Globe, desc: 'Sync corporate email and calendars', category: 'Productivity' },
  { name: 'Xero', icon: Database, desc: 'Access ledger and invoice data', category: 'Finance' },
  { name: 'QuickBooks', icon: Calculator, desc: 'Sync accounting and tax data', category: 'Finance' },
  { name: 'Shopify', icon: Package, desc: 'Monitor orders and customer data', category: 'E-commerce' },
  { name: 'Notion', icon: FileText, desc: 'Grounding in wiki and project docs', category: 'Knowledge' },
  { name: 'Slack', icon: MessageSquare, desc: 'Real-time team communication sync', category: 'Communication' },
];

const agentConfigs: Record<string, any> = {
  'executive-assistant': { 
     role: 'Ops & Scheduling', icon: <Calendar size={24}/>, 
     grounding: ['Google Calendar', 'Gmail', 'Microsoft Outlook', 'Slack', 'Notion'],
     unconnected: ['Gmail', 'Google Calendar'],
     flow: [
       { id: 1, type: 'trigger', label: 'Inbound Request', desc: 'Monitor Gmail and Slack for high-priority scheduling requests' },
       { id: 2, type: 'action', label: 'Intent Analysis', desc: 'Classify request as "Meeting", "Information Query", or "Task"' },
       { id: 3, type: 'condition', label: 'Availability Check', desc: 'Cross-reference multiple calendars for potential conflicts' },
       { id: 4, type: 'action', label: 'Draft Response', desc: 'Prepare invite or reply with suggested times based on preferences' },
       { id: 5, type: 'action', label: 'Notify User', desc: 'Send summary to user for final approval before dispatch' }
     ]
  },
  'financial-controller': { 
     role: 'Strategic Finance', icon: <Calculator size={24}/>, 
     grounding: ['QuickBooks', 'Xero', 'Shopify', 'Notion'],
     flow: [
       { id: 1, type: 'trigger', label: 'Bank Sync', desc: 'Triggered when new transactions are pulled from bank or ledger' },
       { id: 2, type: 'action', label: 'Categorize Txns', desc: 'Automatically map transactions to the Chart of Accounts' },
       { id: 3, type: 'action', label: 'Update Statements', desc: 'Re-calculate real-time P&L and Cashflow projections' },
       { id: 4, type: 'condition', label: 'Anomaly Check', desc: 'Identify spikes in OPEX or unexpected revenue drops' },
       { id: 5, type: 'action', label: 'Audit Log', desc: 'Generate audit-ready report with links to source documents' }
     ]
  },
  'financial-sentry': { 
     role: 'Cash Leak Auditor', icon: <ShieldCheck size={24}/>, 
     grounding: ['QuickBooks', 'Xero', 'Notion'],
     flow: [
       { id: 1, type: 'trigger', label: 'Invoice Upload', desc: 'Detect new PDF or Image in financial processing folder' },
       { id: 2, type: 'action', label: 'OCR Extraction', desc: 'Identify vendor, date, amount, and line items via AI' },
       { id: 3, type: 'condition', label: 'Validate Math', desc: 'Compare extracted total with sum of individual line items' },
       { id: 4, type: 'action', label: 'Policy Check', desc: 'Reconcile against payment terms and duplicate records' },
       { id: 5, type: 'action', label: 'Risk Score', desc: 'Generate recommendation (Approve/Flag) for review' }
     ]
  },
  'debt-recovery': { 
     role: 'AR Automation', icon: <DollarSign size={24}/>, 
     grounding: ['QuickBooks', 'Xero', 'Slack'],
     flow: [
       { id: 1, type: 'trigger', label: 'Aging Report Update', desc: 'Detect overdue invoices from accounting feeds' },
       { id: 2, type: 'action', label: 'Risk Mapping', desc: 'Categorize debtors by "Regular", "Late", or "Chronic" profiles' },
       { id: 3, type: 'action', label: 'Sentiment Outreach', desc: 'Draft diplomatic follow-ups that escalate based on age' },
       { id: 4, type: 'action', label: 'Payment Link', desc: 'Generate unique links via Stripe or Razorpay' },
       { id: 5, type: 'action', label: 'Log Interaction', desc: 'Update CRM with communication status and debtor notes' }
     ]
  },
  'tax-compliance': { 
     role: 'Regulatory Audit', icon: <FileText size={24}/>, 
     grounding: ['QuickBooks', 'Notion', 'Globe'],
     flow: [
       { id: 1, type: 'trigger', label: 'VAT Window', desc: 'Trigger when quarterly tax filing deadline approaches' },
       { id: 2, type: 'action', label: 'VAT Identification', desc: 'Extract VAT IDs and amounts from all taxable transactions' },
       { id: 3, type: 'action', label: 'Reconciliation', desc: 'Calculate Input vs Output tax to determine Net Payable' },
       { id: 4, type: 'action', label: 'Liability Report', desc: 'Generate pre-filing report in authority-required format' },
       { id: 5, type: 'condition', label: 'SOP Verification', desc: 'Ensure all transactions meet local tax compliance rules' }
     ]
  },
  'inventory-optimizer': { 
     role: 'Supply Chain', icon: <Package size={24}/>, 
     grounding: ['Shopify', 'Xero', 'Notion'],
     flow: [
       { id: 1, type: 'trigger', label: 'Stock Low', desc: 'SKU quantity falls below the dynamic safety threshold' },
       { id: 2, type: 'action', label: 'Demand Forecast', desc: 'Analyze historical sales and seasonality for predictions' },
       { id: 3, type: 'action', label: 'Dead Stock ID', desc: 'Flag slow-moving items and suggest liquidation bundles' },
       { id: 4, type: 'action', label: 'Lead Time Audit', desc: 'Monitor supplier performance and adjust reorder points' },
       { id: 5, type: 'action', label: 'Draft PO', desc: 'Generate Purchase Order for owner approval' }
     ]
  },
  'retail-planner': { 
     role: 'Site Selection', icon: <MapPin size={24}/>, 
     grounding: ['Globe', 'Notion', 'Database'],
     flow: [
       { id: 1, type: 'trigger', label: 'Target Zone', desc: 'New area or commercial listing detected for expansion' },
       { id: 2, type: 'action', label: 'Footfall Research', desc: 'Research traffic patterns and landmarks in target radius' },
       { id: 3, type: 'action', label: 'Competitor Map', desc: 'Identify proximity to existing competitors and saturation' },
       { id: 4, type: 'action', label: 'Demographic Sync', desc: 'Analyze if local population matches target persona data' },
       { id: 5, type: 'action', label: 'Score & Report', desc: 'Generate Site Recommendation with ROI projections' }
     ]
  },
  'hr-lifecycle': { 
     role: 'Employee Success', icon: <UserPlus size={24}/>, 
     grounding: ['Slack', 'Notion', 'Gmail'],
     flow: [
       { id: 1, type: 'trigger', label: 'Lifecycle Event', desc: 'Detected "Start Date" or "End Date" in directory' },
       { id: 2, type: 'action', label: 'Init SOP', desc: 'Initialize stateful workflow based on company policy' },
       { id: 3, type: 'action', label: 'Provision Systems', desc: 'Automate access to Slack, Jira, and Email' },
       { id: 4, type: 'action', label: 'Stakeholder Alert', desc: 'Notify IT and Admin for equipment and ID card logistics' },
       { id: 5, type: 'action', label: 'Audit Logging', desc: 'Update employee history for compliance records' }
     ]
  },
  'hr-screening': { 
     role: 'Talent Acquisition', icon: <UserSearch size={24}/>, 
     grounding: ['Notion', 'Gmail', 'LinkedIn'],
     flow: [
       { id: 1, type: 'trigger', label: 'New Application', desc: 'Candidate submitted resume via portal or email' },
       { id: 2, type: 'action', label: 'Resume Parser', desc: 'Extract skills, experience, and contact info via AI' },
       { id: 3, type: 'action', label: 'Semantic Matching', desc: 'Score candidate against Job Description and Culture SOP' },
       { id: 4, type: 'condition', label: 'Score Threshold', desc: 'Determine if candidate meets minimum 80% match' },
       { id: 5, type: 'action', label: 'Auto-Schedule', desc: 'Invite top candidates for initial screening call' }
     ]
  },
  'business-strategist': { 
     role: 'Expansion & Growth', icon: <TrendingUp size={24}/>, 
     grounding: ['Globe', 'Notion', 'Slack'],
     flow: [
       { id: 1, type: 'trigger', label: 'Intel Request', desc: 'New market research or pitch deck request initiated' },
       { id: 2, type: 'action', label: 'Web Research', desc: 'Conduct multi-step browsing for competitor trends' },
       { id: 3, type: 'action', label: 'Data Synthesis', desc: 'Map internal performance against external benchmarks' },
       { id: 4, type: 'action', label: 'Narrative Flow', desc: 'Structure the Problem, Solution, and Market narrative' },
       { id: 5, type: 'action', label: 'Asset Generation', desc: 'Produce structured deck content or research report' }
     ]
  },
  'sales-growth': { 
     role: 'Revenue Generation', icon: <Zap size={24}/>, 
     grounding: ['Gmail', 'LinkedIn', 'Slack'],
     flow: [
       { id: 1, type: 'trigger', label: 'Lead Gen Goal', desc: 'Target industry and location set for new campaign' },
       { id: 2, type: 'action', label: 'Entity Scraping', desc: 'Extract lead data from LinkedIn and business directories' },
       { id: 3, type: 'action', label: 'Fit Analysis', desc: 'Analyze lead websites to determine technological match' },
       { id: 4, type: 'action', label: 'Draft Pitch', desc: 'Generate hyper-personalized outreach based on lead data' },
       { id: 5, type: 'action', label: 'CRM Sync', desc: 'Push qualified leads to HubSpot/Salesforce for follow-up' }
     ]
  },
  'network-intelligence': { 
     role: 'Referral Mapping', icon: <Share2 size={24}/>, 
     grounding: ['LinkedIn', 'Gmail', 'Notion'],
     flow: [
       { id: 1, type: 'trigger', label: 'Contact Sync', desc: 'Detected new high-value contact or relationship' },
       { id: 2, type: 'action', label: 'Graph Mapping', desc: 'Crawl professional network for warm introduction paths' },
       { id: 3, type: 'action', label: 'Intro ID', desc: 'Identify mutual connections with decision-makers' },
       { id: 4, type: 'action', label: 'Draft Strategy', desc: 'Prepare referral request or intro script' },
       { id: 5, type: 'action', label: 'Notify User', desc: 'Alert user to potential networking opportunity' }
     ]
  },
  'creative-director': { 
     role: 'Brand & Content', icon: <Palette size={24}/>, 
     grounding: ['Notion', 'Instagram', 'Pinterest'],
     flow: [
       { id: 1, type: 'trigger', label: 'Brief Detected', desc: 'New campaign request found in project folder' },
       { id: 2, type: 'action', label: 'Brand Audit', desc: 'Verify request against brand style guide and tone' },
       { id: 3, type: 'action', label: 'Moodboard Gen', desc: 'Synthesize visual direction and copywriting hooks' },
       { id: 4, type: 'action', label: 'Asset Drafting', desc: 'Generate image prompts and ad copy variants' },
       { id: 5, type: 'action', label: 'Package Bundle', desc: 'Finalize campaign package for human review' }
     ]
  },
  'legal-analyst': { 
     role: 'Contract Risk', icon: <Gavel size={24}/>, 
     grounding: ['Notion', 'Gmail', 'Microsoft Outlook'],
     flow: [
       { id: 1, type: 'trigger', label: 'Contract Upload', desc: 'New document detected in legal or audit folder' },
       { id: 2, type: 'action', label: 'Clause Extract', desc: 'Extract key clauses, liabilities, and obligations' },
       { id: 3, type: 'condition', label: 'Risk Audit', desc: 'Compare against legal policy for high-risk flags' },
       { id: 4, type: 'action', label: 'Compliance Check', desc: 'Verify regulatory alignment with SME local laws' },
       { id: 5, type: 'action', label: 'Summary Report', desc: 'Generate executive summary and risk scoring' }
     ]
  }
};

const mockEmails = [
  { id: 'm1', from: 'john.smith@gmail.com', subject: 'Partnership Discussion', body: 'Hi, I would like to book a meeting for tomorrow at 2 PM to discuss the new partnership agreement.', time: '10:30 AM' },
  { id: 'm2', from: 'sarah.jones@marketing.co', subject: 'Q3 Campaign Review', body: 'Could we sync up on Thursday for a quick review of the social assets?', time: '09:15 AM' },
  { id: 'm3', from: 'billing@aws.com', subject: 'Invoice for April', body: 'Your AWS invoice for April is now available. Total amount: $1,240.22', time: 'Yesterday' },
];

const mockCalendar = [
  { id: 'e1', title: 'Daily Standup', start: '09:00', end: '09:30' },
  { id: 'e2', title: 'Internal Strategy', start: '14:00', end: '15:30' },
];

export default function AgentDetailPage() {
  const { id } = useParams();
  const agentId = id as string;
  const currentConfig = agentConfigs[agentId] || { 
    role: 'AI Agent', icon: <Cpu size={24}/>, 
    grounding: ['Notion', 'Gmail'],
    flow: [] 
  };
  const agentName = agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const [activeTab, setActiveTab] = useState('Workflow');
  const [activeConfigTab, setActiveConfigTab] = useState('Settings');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isAddDataModalOpen, setIsAddDataModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [workflowNodes, setWorkflowNodes] = useState<any[]>(currentConfig.flow);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isActivated, setIsActivated] = useState(true);
  const [connectionStates, setConnectionStates] = useState<Record<string, 'unconnected' | 'connecting' | 'connected'>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [simActiveNode, setSimActiveNode] = useState<number | null>(null);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [inbox, setInbox] = useState(mockEmails);
  const [availability, setAvailability] = useState(mockCalendar);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [connectEmail, setConnectEmail] = useState('ahmed.rakib@gmail.com');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [providerToken, setProviderToken] = useState<string | null>(null);
  const [ledgerSheetId, setLedgerSheetId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLedger = localStorage.getItem(`ledger_${agentId}_v2`);
      if (savedLedger) setLedgerSheetId(savedLedger);
    }
  }, [agentId]);

  const [analyticsSubTab, setAnalyticsSubTab] = useState('Neural Health');
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Load weekly reports from Supabase or localStorage fallback
  useEffect(() => {
    const fetchWeeklyReports = async () => {
      try {
        const { data, error } = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('agent_id', 'executive-assistant')
          .order('created_at', { ascending: false });
        if (data && data.length > 0) {
          setWeeklyReports(data);
          setSelectedReport(data[0]);
        } else {
          const localSaved = localStorage.getItem(`weekly_reports_${agentId}_v2`);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            setWeeklyReports(parsed);
            setSelectedReport(parsed[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch reports from DB, falling back:", err);
        const localSaved = localStorage.getItem(`weekly_reports_${agentId}_v2`);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          setWeeklyReports(parsed);
          setSelectedReport(parsed[0]);
        }
      }
    };
    fetchWeeklyReports();
  }, [agentId]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskType, setNewTaskType] = useState('Autonomous');
  // Initialize Vercel AI SDK Chat
  const [input, setInput] = useState('');

  const defaultMessage = { 
    id: '1',
    role: 'assistant' as const, 
    parts: [{ type: 'text' as const, text: `Welcome to the ${agentName} Studio. I am fully synchronized with your ${currentConfig.grounding.join(' and ')} data feeds. How can I assist with your workflow today?` }]
  };

  const { messages, setMessages, status, sendMessage, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' })
  });

  const handleGenerateWeeklyReport = useCallback(async (autoTrigger = false) => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providerToken,
          email: connectEmail,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      const data = await res.json();
      if (data.success && data.report) {
        const newReport = data.report;
        setWeeklyReports(prev => {
          const updated = [newReport, ...prev];
          localStorage.setItem(`weekly_reports_${agentId}_v2`, JSON.stringify(updated));
          return updated;
        });
        setSelectedReport(newReport);
        
        // Append report as an assistant message in the chat
        const reportMessage = {
          id: `report-${Date.now()}`,
          role: 'assistant' as const,
          parts: [{ 
            type: 'text' as const, 
            text: `### 📊 Weekly Report ${autoTrigger ? '(Auto-generated)' : ''}\n\n${newReport.reportText}` 
          }]
        };
        setMessages(prev => {
          const updated = [...prev, reportMessage];
          localStorage.setItem('chat_' + agentId + '_v2', JSON.stringify(updated));
          return updated;
        });
      } else {
        if (!autoTrigger) {
          alert(data.error || 'Failed to generate weekly report.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (!autoTrigger) {
        alert('Error generating report: ' + err.message);
      }
    } finally {
      setIsGeneratingReport(false);
    }
  }, [providerToken, connectEmail, agentId, setMessages, isGeneratingReport, weeklyReports]);

  // Helper to calculate the most recent Saturday 10 PM
  const getMostRecentSaturday10PM = useCallback((now: Date): Date => {
    const result = new Date(now);
    const day = result.getDay(); // 0: Sun, 6: Sat
    const diff = (day + 1) % 7; // Sunday goes back 1 day, Saturday goes back 0
    result.setDate(result.getDate() - diff);
    result.setHours(22, 0, 0, 0);
    // If it is Saturday but before 10 PM, go back 7 days
    if (day === 6 && now.getHours() < 22) {
      result.setDate(result.getDate() - 7);
    }
    return result;
  }, []);

  // Monitor Saturday 10 PM scheduled delivery
  useEffect(() => {
    if (agentId !== 'executive-assistant') return;

    const checkScheduledDelivery = () => {
      const now = new Date();
      const lastSat10PM = getMostRecentSaturday10PM(now);
      const lastDelivered = localStorage.getItem(`last_report_delivered_${agentId}_v2`);

      if (!lastDelivered || new Date(lastDelivered) < lastSat10PM) {
        console.log("Saturday 10 PM trigger: Generating and delivering report...");
        handleGenerateWeeklyReport(true);
        localStorage.setItem(`last_report_delivered_${agentId}_v2`, lastSat10PM.toISOString());
      }
    };

    // Run check on mount and then every 2 minutes
    checkScheduledDelivery();
    const interval = setInterval(checkScheduledDelivery, 120000);
    return () => clearInterval(interval);
  }, [agentId, getMostRecentSaturday10PM, handleGenerateWeeklyReport]);

  // SDK v6: extract tool parts from parts array
  const getToolParts = useCallback((m: any): any[] => {
    if (!m.parts) return [];
    return m.parts.filter((p: any) =>
      p.type === 'dynamic-tool' ||
      p.type === 'tool-call' ||
      (typeof p.type === 'string' && p.type.startsWith('tool-'))
    );
  }, []);

  const processedToolCalls = useRef<Set<string>>(new Set());

  // On mount: restore the set of already-processed tool call IDs from localStorage
  // so we don't create duplicate tasks when messages are restored from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`processedCalls_${agentId}_v2`);
    if (saved) {
      try {
        const ids: string[] = JSON.parse(saved);
        ids.forEach(id => processedToolCalls.current.add(id));
      } catch {}
    }
  }, [agentId]);

  // Restore messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`chat_${agentId}_v2`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((m: any) => {
          if (m.parts) return m;
          const parts = [];
          if (m.content) {
            parts.push({ type: 'text', text: m.content });
          }
          return { ...m, parts };
        });
        if (parsed.length > 0) {
          // Pre-populate processed tool calls to prevent duplicate tasks on reload
          parsed.forEach((m: any) => {
            const toolParts = getToolParts(m);
            toolParts.forEach((p: any, index: number) => {
              const toolName = p.toolName || p.name || (typeof p.type === 'string' ? p.type.replace('tool-', '') : '');
              const toolCallId = p.toolCallId || p.id || `${m.id}-${toolName}-${index}`;
              if (toolCallId) processedToolCalls.current.add(toolCallId);
            });
          });
          setMessages(parsed);
        } else {
          setMessages([defaultMessage]);
        }
      } catch (e) {
        setMessages([defaultMessage]);
      }
    } else {
      setMessages([defaultMessage]);
    }
  }, [agentId, setMessages, getToolParts]);

  // Save messages on change
  useEffect(() => {
    if (messages && messages.length > 0) {
      localStorage.setItem(`chat_${agentId}_v2`, JSON.stringify(messages));
    }
  }, [messages, agentId]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e?: any) => {
    e?.preventDefault?.();
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    setInput('');
    // Pass providerToken and email dynamically via sendMessage body — this is merged
    // into the request body alongside the auto-serialized messages array.
    await sendMessage({ text: userMessage }, {
      body: {
        providerToken,
        email: connectEmail,
        agentName,
        agentId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toString(),
        spreadsheetId: ledgerSheetId,
      }
    });
  };

  // SDK v6: extract text from parts array
  const getMessageText = (m: any): string => {
    if (!m.parts) return m.content || '';
    return m.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  };



  // Listen for AI tool calls to create tasks automatically
  useEffect(() => {
    if (!messages) return;
    
    const newTasksToAdding: any[] = [];

    messages.forEach(m => {
      const toolParts = getToolParts(m);
      toolParts.forEach((part: any, index: number) => {
        const toolName = part.toolName || part.name || (typeof part.type === 'string' ? part.type.replace('tool-', '') : '');
        const toolCallId = part.toolCallId || part.id || `${m.id}-${toolName}-${index}`;
        const state = part.state || '';
        
        // Ensure we only process tool calls once they are fully executed
        if (toolCallId && state === 'output-available' && !processedToolCalls.current.has(toolCallId)) {
          let isTask = false;
          let title = '';
          let status = 'Pending';
          let priority = 'Medium';
          const args = part.args || {};

          if (toolName === 'createAgentTask') {
            title = args.title || 'New Agent Task';
            priority = args.priority || 'Medium';
            status = 'Pending';
            isTask = true;
          } else if (toolName === 'sendEmail') {
            title = `Introductory Email sent to ${args.to || 'Contact'}`;
            priority = 'High';
            status = 'Completed';
            isTask = true;
          } else if (toolName === 'createMeeting') {
            title = `Meeting Scheduled: ${args.summary || 'Event'}`;
            priority = 'High';
            status = 'Completed';
            isTask = true;
          }

          if (isTask) {
            processedToolCalls.current.add(toolCallId);
            newTasksToAdding.push({
              id: `T-${Math.floor(Math.random() * 9000) + 1000}`,
              title: title,
              priority: priority,
              status: status,
              deadline: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              type: 'Autonomous'
            });
          }
        }
      });
    });

    if (newTasksToAdding.length > 0) {
      setTasks(prev => {
        // Prevent duplicates: only add tasks whose id doesn't already exist
        const existingIds = new Set(prev.map((t: any) => t.id));
        const truly_new = newTasksToAdding.filter(t => !existingIds.has(t.id));
        if (truly_new.length === 0) return prev;
        const updated = [...truly_new, ...prev];
        localStorage.setItem(`tasks_${agentId}_v2`, JSON.stringify(updated));
        return updated;
      });
      setNotifications(prev => {
        const newNotifs = newTasksToAdding.map(t => ({ 
          type: t.status === 'Completed' ? 'Report' : 'Action', 
          title: t.status === 'Completed' ? `Task Completed: ${t.title}` : `New Mission Launched: ${t.title}`, 
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), 
          status: 'Unread' 
        }));
        const updated = [...newNotifs, ...prev];
        localStorage.setItem(`notifs_${agentId}_v2`, JSON.stringify(updated));
        return updated;
      });
      // Persist processed call IDs to localStorage
      const allIds = Array.from(processedToolCalls.current);
      localStorage.setItem(`processedCalls_${agentId}_v2`, JSON.stringify(allIds));
    }
  }, [messages, agentId]);

  const [tasks, setTasks] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(`tasks_${agentId}_v2`) || '[]'); } catch { return []; }
  });
  const [notifications, setNotifications] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(`notifs_${agentId}_v2`) || '[]'); } catch { return []; }
  });
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);


  const tabs = [
    { name: 'Chat', icon: MessageSquare },
    { name: 'Task', icon: ListTodo },
    { name: 'Workflow', icon: Zap },
    { name: 'Knowledge', icon: BookOpen },
    { name: 'Notifications', icon: Bell },
    { name: 'Configurations', icon: SettingsIcon },
    { name: 'Analytics', icon: LineChart },
    { name: 'Real World Data', icon: Database },
  ];

  useEffect(() => {
    setWorkflowNodes(currentConfig.flow);
    
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    // Check for existing Supabase session with Google provider token
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.provider_token || getCookie('provider_token');
      if (token) {
        setProviderToken(token);
        setConnectionStates(prev => ({ ...prev, 'Gmail': 'connected', 'Google Calendar': 'connected' }));
        if (session?.user?.email) {
          setConnectEmail(session.user.email);
        }
      }
    });

    // Fetch Integrations from Supabase
    const fetchIntegrations = async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*');
      
      if (data) {
        const states: any = {};
        data.forEach(item => {
          states[item.app_name] = item.status === 'Connected' ? 'connected' : 'unconnected';
        });
        setConnectionStates(prev => ({ ...prev, ...states }));
      }
    };

    // Fetch Knowledge from Supabase
    const fetchKnowledge = async () => {
      const { data, error } = await supabase
        .from('knowledge')
        .select('*');
      
      if (data) {
        setKnowledgeItems(data);
      }
    };

    fetchIntegrations();
    fetchKnowledge();
  }, [agentId]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      localStorage.setItem(`tasks_${agentId}_v2`, JSON.stringify(updated));
      return updated;
    });

    // Add notification
    setNotifications(prev => {
      const updated = [{ type: 'Update', title: `Task ${taskId} status changed to ${newStatus}`, time: 'Just now', status: 'Unread' }, ...prev];
      localStorage.setItem(`notifs_${agentId}_v2`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle) return;

    const newTask = {
      id: `T-${Math.floor(Math.random() * 10000)}`,
      title: newTaskTitle,
      priority: newTaskPriority,
      status: 'Pending',
      type: newTaskType,
      deadline: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };

    setTasks(prev => {
      const updated = [newTask, ...prev];
      localStorage.setItem(`tasks_${agentId}_v2`, JSON.stringify(updated));
      return updated;
    });

    setNotifications(prev => {
      const updated = [{ type: 'Action', title: `New Mission Launched: ${newTaskTitle}`, time: 'Just now', status: 'Unread' }, ...prev];
      localStorage.setItem(`notifs_${agentId}_v2`, JSON.stringify(updated));
      return updated;
    });
    
    setIsCreateTaskModalOpen(false);
    setNewTaskTitle('');
  };

  const handleAllowAccess = async () => {
    if (connectingService) {
      setConnectionStates(prev => ({ ...prev, [connectingService]: 'connected' }));
      
      const { error } = await supabase
        .from('integrations')
        .upsert({ 
          app_name: connectingService, 
          status: 'Connected',
          category: allSources.find(s => s.name === connectingService)?.category || 'Other'
        }, { onConflict: 'app_name' });
      
      if (error) console.error("Integration persist error:", error);
    }
    setIsConnectModalOpen(false);
  };

  const handleAddKnowledge = async (fileName: string) => {
    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        
        // Save to Supabase
        supabase.from('knowledge').insert([{
          file_name: fileName,
          file_size: Math.floor(Math.random() * 1024 * 1024 * 10), // Mock size
          file_type: fileName.split('.').pop() || 'unknown',
          storage_path: `knowledge/${fileName}`
        }]).select().then(({ data }) => {
          if (data) {
            setKnowledgeItems(prev => [data[0], ...prev]);
          }
          setIsUploading(false);
          setIsAddDataModalOpen(false);
          setUploadProgress(0);
        });
      }
    }, 200);
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimLogs(['[SYSTEM] Initiating neural simulation...', '[SYSTEM] Grounding sources verified.']);
    
    for (let i = 0; i < workflowNodes.length; i++) {
      const node = workflowNodes[i];
      setSimActiveNode(node.id);
      setSimLogs(prev => [...prev, `[THOUGHT] Executing ${node.type.toUpperCase()}: ${node.label}...`]);
      
      await new Promise(r => setTimeout(r, 2000));
      
      if (node.type === 'condition') {
        setSimLogs(prev => [...prev, `[DECISION] Evaluating condition... Result: SUCCESS (0.98 confidence)`]);
      } else if (node.type === 'trigger') {
        setSimLogs(prev => [...prev, `[EVENT] Data detected in grounding feeds.`]);
      } else {
        setSimLogs(prev => [...prev, `[ACTION] Tool output: Success.`]);
      }
      
      setSimLogs(prev => [...prev, `[SYSTEM] Step ${node.id} completed.`]);
    }
    
    setSimActiveNode(null);
    setSimLogs(prev => [...prev, '[FINISH] Simulation complete. Mission objective achieved.']);
    setTimeout(() => setIsSimulating(false), 3000);
  };

  const updateNode = (id: number, updates: any) => {
    setWorkflowNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    setSelectedNode((prev: any) => ({ ...prev, ...updates }));
  };

  // Removed handleSendMessage, useChat provides handleSubmit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Area */}
      <div className="flex-between">
         <div className="flex-items-center" style={{ gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
               {currentConfig.icon}
            </div>
            <div>
               <div className="flex-items-center" style={{ gap: '8px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800' }}>{agentName} Studio</h1>
                  <div style={{ padding: '2px 6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', color: '#10b981', fontSize: '9px', fontWeight: '800' }}>ONLINE</div>
               </div>
               <p className="text-sm" style={{ opacity: 0.6 }}>{currentConfig.role}</p>
            </div>
         </div>
         <div className="flex-items-center" style={{ gap: '12px' }}>
             <button 
               className="btn-secondary" 
               style={{ fontSize: '12px' }}
               onClick={() => setMessages([])}
             >
               Reset Logic
             </button>
            <button className="btn-primary flex-items-center" style={{ gap: '8px', fontSize: '12px' }}>
               <Play size={14} /> Deploy Changes
            </button>
         </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-main)', gap: '40px', marginBottom: '8px' }}>
         {tabs.map((tab) => {
           const Icon = tab.icon;
           const isActive = activeTab === tab.name;
           return (
             <button 
               key={tab.name} 
               onClick={() => setActiveTab(tab.name)}
               style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 4px', 
                  border: 'none', background: 'transparent',
                  color: isActive ? '#3b82f6' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '700' : '500',
                  transition: 'all 0.2s ease',
                  marginBottom: '-1px'
               }}
             >
               <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
               {tab.name}
             </button>
           );
         })}
      </div>

      {/* Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
         
         {/* CHAT TAB */}
         {activeTab === 'Chat' && (
           <div className="stat-card" style={{ height: '600px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-main)' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(2, 4, 10, 0.4)' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                 <span style={{ fontSize: '13px', fontWeight: '700' }}>Grounded Session</span>
                 <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>• Connected to {currentConfig.grounding.join(', ')}</span>
              </div>
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 {messages?.map((m: any) => {
                      const textContent = getMessageText(m);
                      const toolParts = getToolParts(m);
                      return (
                     <div key={m.id} style={{ alignSelf: m.role === 'assistant' ? 'flex-start' : 'flex-end', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                       <div style={{ padding: '14px 18px', background: m.role === 'assistant' ? 'rgba(255,255,255,0.03)' : '#2563EB', borderRadius: '16px', borderTopLeftRadius: m.role === 'assistant' ? '4px' : '16px', borderTopRightRadius: m.role === 'user' ? '4px' : '16px', border: m.role === 'assistant' ? '1px solid var(--border-main)' : 'none', fontSize: '14px', lineHeight: '1.5', color: 'white' }}>
                            {textContent && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(() => {
                                  const parseInline = (line: string) => {
                                    const parts = line.split(/\*\*([^*]+)\*\*/g);
                                    return parts.map((part, idx) => {
                                      if (idx % 2 === 1) {
                                        return <strong key={idx} style={{ color: m.role === 'assistant' ? '#ffffff' : '#e0e7ff', fontWeight: '700' }}>{part}</strong>;
                                      }
                                      return part;
                                    });
                                  };

                                  const lines = textContent.split('\n');
                                  const elements: React.ReactNode[] = [];
                                  let currentList: React.ReactNode[] = [];

                                  const flushList = () => {
                                    if (currentList.length > 0) {
                                      elements.push(
                                        <ul key={`list-${elements.length}`} style={{ paddingLeft: '20px', margin: '4px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          {currentList}
                                        </ul>
                                      );
                                      currentList = [];
                                    }
                                  };

                                  lines.forEach((line, idx) => {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
                                      const content = trimmed.startsWith('* ') || trimmed.startsWith('- ') 
                                        ? trimmed.substring(2) 
                                        : trimmed.replace(/^\d+\.\s/, '');
                                      currentList.push(
                                        <li key={`li-${idx}`} style={{ lineHeight: '1.5' }}>
                                          {parseInline(content)}
                                        </li>
                                      );
                                    } else {
                                      flushList();
                                      if (trimmed.startsWith('# ')) {
                                        elements.push(
                                          <h4 key={idx} style={{ fontSize: '15px', fontWeight: '800', margin: '12px 0 6px 0', color: 'white' }}>
                                            {parseInline(trimmed.substring(2))}
                                          </h4>
                                        );
                                      } else if (trimmed.startsWith('## ')) {
                                        elements.push(
                                          <h5 key={idx} style={{ fontSize: '13px', fontWeight: '700', margin: '10px 0 4px 0', color: 'white' }}>
                                            {parseInline(trimmed.substring(3))}
                                          </h5>
                                        );
                                      } else if (trimmed.startsWith('>')) {
                                        elements.push(
                                          <div key={idx} style={{ borderLeft: '3px solid rgba(255,255,255,0.3)', paddingLeft: '10px', margin: '8px 0', fontStyle: 'italic', opacity: 0.8 }}>
                                            {parseInline(trimmed.substring(1).trim())}
                                          </div>
                                        );
                                      } else if (trimmed === '') {
                                        elements.push(<div key={idx} style={{ height: '4px' }} />);
                                      } else {
                                        elements.push(
                                          <p key={idx} style={{ margin: '2px 0', lineHeight: '1.5' }}>
                                            {parseInline(trimmed)}
                                          </p>
                                        );
                                      }
                                    }
                                  });
                                  flushList();
                                  return elements;
                                })()}
                              </div>
                            )}

                           {toolParts.map((part: any, index: number) => {
                             // SDK v6: toolName lives on the part directly
                             const toolName: string = part.toolName || part.name || (typeof part.type === 'string' ? part.type.replace('tool-', '') : '');
                             const toolCallId: string = part.toolCallId || part.id || `${m.id}-${toolName}-${index}`;
                             const state: string = part.state || '';
                             // States: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
                             const isPending = state === 'input-streaming' || state === 'input-available';
                             const isResult = state === 'output-available';
                             const isError = state === 'output-error';
                             const output = isResult ? part.output : null;

                             if (isPending) {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                   <div className="flex-items-center" style={{ gap: '8px' }}>
                                     <Loader2 size={14} className="animate-spin" color="#3b82f6" />
                                     <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Executing {toolName}...</span>
                                   </div>
                                 </div>
                               );
                             }

                             if (isError) {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.07)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                   <div className="flex-items-center" style={{ gap: '8px' }}>
                                     <X size={14} color="#ef4444" />
                                     <span style={{ fontSize: '11px', color: '#ef4444' }}>Tool error: {part.errorText || 'Unknown error'}</span>
                                   </div>
                                 </div>
                               );
                             }

                             if (toolName === 'readEmails') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                                       <div className="flex-items-center" style={{ gap: '8px' }}>
                                          <Globe size={14} color="#3b82f6" />
                                          <span style={{ fontSize: '11px', fontWeight: '800' }}>GMAIL: RECENT INBOX</span>
                                       </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                       {output?.emails ? output.emails.slice(0, 3).map((email: any) => (
                                         <div key={email.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '12px' }}>
                                            <p style={{ fontWeight: '700', marginBottom: '2px' }}>{email.subject}</p>
                                            <p style={{ opacity: 0.5, fontSize: '10px' }}>From: {email.from}</p>
                                         </div>
                                       )) : <p style={{ fontSize: '12px', opacity: 0.5 }}>{output?.error || 'No unread emails found.'}</p>}
                                    </div>
                                 </div>
                               );
                             }

                             if (toolName === 'checkCalendar') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                                       <div className="flex-items-center" style={{ gap: '8px' }}>
                                          <Calendar size={14} color="#10b981" />
                                          <span style={{ fontSize: '11px', fontWeight: '800' }}>CALENDAR: UPCOMING</span>
                                       </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                       {output?.events ? output.events.slice(0, 3).map((ev: any) => (
                                         <div key={ev.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '12px' }}>
                                            <p style={{ fontWeight: '700', marginBottom: '2px' }}>{ev.summary}</p>
                                            <p style={{ opacity: 0.5, fontSize: '10px' }}>{new Date(ev.start).toLocaleString()}</p>
                                         </div>
                                       )) : <p style={{ fontSize: '12px', opacity: 0.5 }}>{output?.error || 'No upcoming events.'}</p>}
                                    </div>
                                 </div>
                               );
                             }

                             if (toolName === 'createMeeting' || toolName === 'sendEmail') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                   <div className="flex-items-center" style={{ gap: '8px' }}>
                                     <CheckCircle2 size={14} color="#10b981" />
                                     <span style={{ fontSize: '11px', color: '#10b981' }}>{output?.success ? 'Action Completed Successfully' : output?.error || 'Executing action...'}</span>
                                   </div>
                                 </div>
                               );
                             }

                             if (toolName === 'queryFinancials') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                                       <div className="flex-items-center" style={{ gap: '8px' }}>
                                          <Database size={14} color="#3b82f6" />
                                          <span style={{ fontSize: '11px', fontWeight: '800' }}>FINANCIAL REPORT</span>
                                       </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                       {output?.transactions ? (
                                         <>
                                           <div style={{ display: 'flex', gap: '12px' }}>
                                             <div style={{ flex: 1, padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                                               <p style={{ fontSize: '10px', opacity: 0.7 }}>Total Income</p>
                                               <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>${output.totalIncome?.toFixed(2)}</p>
                                             </div>
                                             <div style={{ flex: 1, padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                                               <p style={{ fontSize: '10px', opacity: 0.7 }}>Total Expense</p>
                                               <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>${output.totalExpense?.toFixed(2)}</p>
                                             </div>
                                             <div style={{ flex: 1, padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                                               <p style={{ fontSize: '10px', opacity: 0.7 }}>Net Cash</p>
                                               <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>${output.netCash?.toFixed(2)}</p>
                                             </div>
                                           </div>
                                           <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                             <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                               <thead>
                                                 <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                                   <th style={{ padding: '8px 4px' }}>Date</th>
                                                   <th style={{ padding: '8px 4px' }}>Category</th>
                                                   <th style={{ padding: '8px 4px' }}>Desc</th>
                                                   <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
                                                 </tr>
                                               </thead>
                                               <tbody>
                                                 {output.transactions.map((t: any, i: number) => (
                                                   <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                     <td style={{ padding: '8px 4px', opacity: 0.7 }}>{t.date}</td>
                                                     <td style={{ padding: '8px 4px' }}>{t.category}</td>
                                                     <td style={{ padding: '8px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{t.description}</td>
                                                     <td style={{ padding: '8px 4px', textAlign: 'right', color: t.type === 'Income' ? '#10b981' : '#ef4444' }}>${t.amount?.toFixed(2)}</td>
                                                   </tr>
                                                 ))}
                                               </tbody>
                                             </table>
                                           </div>
                                         </>
                                       ) : <p style={{ fontSize: '12px', opacity: 0.5 }}>{output?.error || 'No financial data.'}</p>}
                                    </div>
                                 </div>
                               );
                             }

                             if (toolName === 'checkBalanceAndAlerts') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                                       <div className="flex-items-center" style={{ gap: '8px' }}>
                                          <DollarSign size={14} color="#f59e0b" />
                                          <span style={{ fontSize: '11px', fontWeight: '800' }}>CASH FLOW ANALYSIS</span>
                                       </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                       {output?.alerts ? (
                                         <>
                                           <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                             <p style={{ fontSize: '12px', marginBottom: '4px' }}>Current Balance: <strong style={{ color: output.currentBalance < 1000 ? '#ef4444' : '#10b981' }}>${output.currentBalance?.toFixed(2)}</strong></p>
                                             <p style={{ fontSize: '11px', opacity: 0.7 }}>{output.forecast}</p>
                                           </div>
                                           {output.alerts.map((a: string, i: number) => (
                                             <div key={i} style={{ padding: '8px', background: a.includes('Anomaly') || a.includes('warning') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', fontSize: '11px', color: a.includes('Anomaly') || a.includes('warning') ? '#ef4444' : '#10b981' }}>
                                                {a}
                                             </div>
                                           ))}
                                         </>
                                       ) : <p style={{ fontSize: '12px', opacity: 0.5 }}>{output?.error || 'No alerts available.'}</p>}
                                    </div>
                                 </div>
                               );
                             }

                             if (toolName === 'createLedger' || toolName === 'addTransaction') {
                               return (
                                 <div key={toolCallId} style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                   <div className="flex-items-center" style={{ gap: '8px' }}>
                                     <CheckCircle2 size={14} color="#10b981" />
                                     <span style={{ fontSize: '11px', color: '#10b981' }}>{output?.success ? (output.message || 'Ledger action completed.') : (output?.error || 'Executing ledger action...')}</span>
                                   </div>
                                 </div>
                               );
                             }

                             return null;
                           })}
                       </div>

                       <span style={{ fontSize: '10px', color: 'var(--text-dim)', alignSelf: m.role === 'assistant' ? 'flex-start' : 'flex-end' }}>
                          {m.role === 'assistant' ? agentName : 'You'}
                       </span>
                    </div>
                     );
                   })}
                   {isLoading && (
                     <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.5 }}>
                        <Loader2 size={14} className="animate-spin" />
                        <span style={{ fontSize: '12px' }}>Thinking...</span>
                     </div>
                   )}
                   {error && (
                     <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '12px' }}>
                        <strong>Error:</strong> {error.message || 'The agent failed to respond. Please check your API key and connection.'}
                     </div>
                   )}
               </div>
                <form 
                 onSubmit={handleSubmit}
                 style={{ padding: '24px', borderTop: '1px solid var(--border-main)', background: 'rgba(2, 4, 10, 0.4)', position: 'relative' }}
               >
                 {showAttachMenu && (
                   <div style={{ position: 'absolute', bottom: '100px', left: '24px', background: '#0f172a', border: '1px solid var(--border-main)', borderRadius: '12px', padding: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '4px', width: '200px', zIndex: 100 }}>
                      <button className="flex-items-center" style={{ gap: '10px', padding: '10px', background: 'transparent', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
                         <ImageIcon size={16} color="#3b82f6" /> Upload Image
                      </button>
                      <button className="flex-items-center" style={{ gap: '10px', padding: '10px', background: 'transparent', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
                         <FileText size={16} color="#ef4444" /> Attach PDF
                      </button>
                      <button className="flex-items-center" style={{ gap: '10px', padding: '10px', background: 'transparent', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}>
                         <Database size={16} color="#10b981" /> Cloud Document
                      </button>
                   </div>
                 )}
                 <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea 
                      id="chat-input"
                      placeholder={`Message ${agentName}...`} 
                      style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '14px', outline: 'none', resize: 'none' }} 
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      value={input}
                      onChange={handleInputChange}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="flex-items-center" style={{ gap: '8px', background: showAttachMenu ? 'rgba(59, 130, 246, 0.1)' : 'transparent', border: 'none', color: showAttachMenu ? '#3b82f6' : 'var(--text-dim)', cursor: 'pointer', fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}>
                          {showAttachMenu ? <X size={18} /> : <AttachmentIcon size={18} />} Attach
                       </button>
                       <button 
                         type="submit"
                         className="btn-primary" 
                         style={{ padding: '10px 28px', borderRadius: '10px', fontWeight: '700' }}
                       >
                          {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Send'}
                       </button>
                    </div>
                 </div>
               </form>
           </div>
         )}

         {/* TASK TAB (WIRED) */}
         {activeTab === 'Task' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="flex-between">
                 <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Mission Control</h2>
                    <p className="text-sm" style={{ opacity: 0.5 }}>Active tasks and autonomous actions for {agentName}</p>
                 </div>
                 <button className="btn-primary flex-items-center" style={{ gap: '8px' }} onClick={() => setIsCreateTaskModalOpen(true)}>
                    <Plus size={16} /> Create Task
                 </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                 {['Pending', 'In Progress', 'Completed'].map(status => (
                   <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="flex-between" style={{ padding: '0 4px' }}>
                         <div className="flex-items-center" style={{ gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'Completed' ? '#10b981' : status === 'In Progress' ? '#3b82f6' : '#f59e0b' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
                         </div>
                         <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: '700' }}>{tasks.filter(t => t.status === status).length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {tasks.filter(t => t.status === status).length === 0 ? (
                           <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                              <ListTodo size={20} style={{ opacity: 0.2, margin: '0 auto 12px auto' }} />
                              <p style={{ fontSize: '12px', opacity: 0.4 }}>No {status.toLowerCase()} tasks</p>
                           </div>
                         ) : tasks.filter(t => t.status === status).map(task => (
                           <div key={task.id} className="stat-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                              <div className="flex-between" style={{ marginBottom: '12px' }}>
                                 <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.4 }}>{task.id}</span>
                                 <div style={{ padding: '2px 8px', borderRadius: '100px', background: task.priority === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', color: task.priority === 'Critical' ? '#ef4444' : 'white', fontSize: '9px', fontWeight: '800' }}>
                                    {task.priority.toUpperCase()}
                                 </div>
                              </div>
                              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', lineHeight: '1.4' }}>{task.title}</h4>
                              <div className="flex-between">
                                 <div className="flex-items-center" style={{ gap: '6px' }}>
                                    <Clock size={12} style={{ opacity: 0.4 }} />
                                    <span style={{ fontSize: '11px', opacity: 0.6 }}>{task.deadline}</span>
                                 </div>
                                 <div className="flex-items-center" style={{ gap: '6px' }}>
                                    <div style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', color: '#3b82f6', fontSize: '9px', fontWeight: '700' }}>{task.type}</div>
                                 </div>
                              </div>
                           </div>
                         ))}
                         <button 
                           onClick={() => setIsCreateTaskModalOpen(true)}
                           style={{ padding: '16px', borderRadius: '12px', border: '2px dashed rgba(255,255,255,0.05)', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                         >
                            + Add Task
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
         )}

         {activeTab === 'Workflow' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="flex-between">
                 <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Logic Orchestrator</h2>
                    <p className="text-sm" style={{ opacity: 0.5 }}>Configure the cognitive sequence of your agent</p>
                 </div>
                 <div className="flex-items-center" style={{ gap: '12px' }}>
                    <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => setWorkflowNodes(currentConfig.flow)}>Reset Flow</button>
                    <button 
                      className={`btn-primary flex-items-center ${isSimulating ? 'opacity-50 pointer-events-none' : ''}`} 
                      style={{ gap: '8px', fontSize: '12px', background: isSimulating ? '#10b981' : '' }}
                      onClick={runSimulation}
                    >
                       {isSimulating ? <Zap size={14} className="animate-pulse" /> : <Play size={14} />}
                       {isSimulating ? 'Simulating...' : 'Run Simulation'}
                    </button>
                    <button className="btn-primary" style={{ fontSize: '12px' }} onClick={() => {
                       const newNode = { id: Date.now(), type: 'action', label: 'New Action', desc: 'Describe the action...' };
                       setWorkflowNodes([...workflowNodes, newNode]);
                    }}>+ Add Logic Step</button>
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 350px' : '1fr', gap: '24px', position: 'relative' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="stat-card" style={{ 
                       minHeight: '600px', 
                       padding: '60px', 
                       display: 'flex', 
                       flexDirection: 'column', 
                       alignItems: 'center',
                       background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.03) 0%, transparent 70%)',
                       overflow: 'hidden',
                       position: 'relative'
                    }}>
                       <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                       
                       <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%' }}>
                          {workflowNodes.map((node, i) => (
                            <React.Fragment key={node.id}>
                               <div 
                                 className={`node-card ${selectedNode?.id === node.id ? 'active' : ''}`}
                                 onClick={() => setSelectedNode(node)}
                                 style={{ 
                                   width: '320px', padding: '20px', borderRadius: '16px', 
                                   background: simActiveNode === node.id ? 'rgba(59, 130, 246, 0.2)' : selectedNode?.id === node.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.9)', 
                                   border: simActiveNode === node.id ? '2px solid #3b82f6' : selectedNode?.id === node.id ? '2px solid #3b82f6' : '1px solid var(--border-main)', 
                                   textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                   transform: simActiveNode === node.id || selectedNode?.id === node.id ? 'scale(1.02)' : 'scale(1)',
                                   boxShadow: simActiveNode === node.id ? '0 0 40px rgba(59, 130, 246, 0.4)' : selectedNode?.id === node.id ? '0 0 30px rgba(59, 130, 246, 0.2)' : 'none',
                                   position: 'relative'
                                 }}
                               >
                                  {simActiveNode === node.id && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', background: '#3b82f6', overflow: 'hidden' }}>
                                       <div style={{ height: '100%', width: '100%', background: 'white', animation: 'shimmer 1.5s infinite' }} />
                                    </div>
                                  )}
                                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                                     <div className="flex-items-center" style={{ gap: '8px' }}>
                                        {node.type === 'trigger' && <Activity size={16} color="#3b82f6" />}
                                        {node.type === 'condition' && <GitBranch size={16} color="#f59e0b" />}
                                        {node.type === 'action' && <Terminal size={16} color="#10b981" />}
                                        <span className="uppercase-label" style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.1em' }}>{node.type}</span>
                                     </div>
                                     <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: node.type === 'trigger' ? '#3b82f6' : node.type === 'condition' ? '#f59e0b' : '#10b981' }} />
                                  </div>
                                  <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '6px', color: 'white' }}>{node.label}</h4>
                                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.5' }}>{node.desc}</p>
                               </div>
                               
                               {i < workflowNodes.length - 1 && (
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                    <div style={{ width: '2px', height: '60px', background: 'linear-gradient(to bottom, #3b82f6, rgba(59, 130, 246, 0.1))' }} />
                                    <div style={{ 
                                       position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
                                       width: '32px', height: '32px', borderRadius: '50%', background: '#02040a', border: '1px solid #3b82f6', 
                                       display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease',
                                       boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
                                    }}
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       const newNode = { id: Date.now(), type: 'action', label: 'Inserted Step', desc: 'Next sequence in logic...' };
                                       const newNodes = [...workflowNodes];
                                       newNodes.splice(i + 1, 0, newNode);
                                       setWorkflowNodes(newNodes);
                                    }}>
                                       <Plus size={16} color="#3b82f6" />
                                    </div>
                                    <div style={{ 
                                       position: 'absolute', bottom: '-8px', width: '0', height: '0', 
                                       borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #3b82f6' 
                                    }} />
                                 </div>
                               )}
                            </React.Fragment>
                          ))}
                       </div>
                    </div>

                    {isSimulating && (
                       <div className="stat-card animate-slide-up" style={{ 
                         padding: '24px', 
                         background: 'rgba(2, 4, 10, 0.8)', 
                         border: '1px solid #3b82f6',
                         boxShadow: '0 0 40px rgba(59, 130, 246, 0.1)',
                         backdropFilter: 'blur(20px)'
                       }}>
                          <div className="flex-between" style={{ marginBottom: '16px' }}>
                             <div className="flex-items-center" style={{ gap: '12px' }}>
                                <div className="flex-items-center" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center' }}>
                                   <Zap size={16} color="#3b82f6" className="animate-pulse" />
                                </div>
                                <div>
                                   <span style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Neural Execution Console</span>
                                   <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Live mission status and cognitive logs</span>
                                </div>
                             </div>
                             <div className="flex-items-center" style={{ gap: '8px', padding: '4px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '100px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>ACTIVE SIMULATION</span>
                             </div>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', flexDirection: 'column', gap: '8px', 
                            background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px',
                            fontFamily: 'monospace', fontSize: '12px', minHeight: '120px', maxHeight: '200px', overflowY: 'auto'
                          }}>
                             {simLogs.map((log, i) => (
                               <div key={i} style={{ color: log.startsWith('[SYSTEM]') ? '#3b82f6' : log.startsWith('[THOUGHT]') ? 'rgba(255,255,255,0.7)' : log.startsWith('[DECISION]') ? '#f59e0b' : '#10b981', display: 'flex', gap: '12px' }}>
                                  <span style={{ opacity: 0.3 }}>{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  <span>{log}</span>
                               </div>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>

                 {selectedNode && (
                    <div className="stat-card" style={{ height: 'fit-content', position: 'sticky', top: '24px', padding: '32px', border: '1px solid var(--border-main)', background: 'rgba(2, 4, 10, 0.4)', backdropFilter: 'blur(20px)' }}>
                       <div className="flex-between" style={{ marginBottom: '32px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Tune Logic</h3>
                          <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                             <X size={20} />
                          </button>
                       </div>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          <div>
                             <label className="uppercase-label" style={{ fontSize: '10px', display: 'block', marginBottom: '8px' }}>Node Type</label>
                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {['trigger', 'condition', 'action'].map(t => (
                                  <button 
                                    key={t}
                                    onClick={() => updateNode(selectedNode.id, { type: t })}
                                    style={{ 
                                       padding: '8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize',
                                       background: selectedNode.type === t ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                       border: selectedNode.type === t ? '1px solid #3b82f6' : '1px solid var(--border-main)',
                                       color: selectedNode.type === t ? '#3b82f6' : 'var(--text-dim)',
                                       cursor: 'pointer'
                                    }}
                                  >
                                     {t}
                                  </button>
                                ))}
                             </div>
                          </div>

                          <div>
                             <label className="uppercase-label" style={{ fontSize: '10px', display: 'block', marginBottom: '8px' }}>Label</label>
                             <input 
                               value={selectedNode.label}
                               onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                               style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '12px', color: 'white', outline: 'none', fontSize: '13px' }}
                             />
                          </div>

                          <div>
                             <label className="uppercase-label" style={{ fontSize: '10px', display: 'block', marginBottom: '8px' }}>Instruction / Description</label>
                             <textarea 
                               value={selectedNode.desc}
                               onChange={(e) => updateNode(selectedNode.id, { desc: e.target.value })}
                               style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '12px', color: 'white', outline: 'none', fontSize: '13px', resize: 'none' }}
                               rows={4}
                             />
                          </div>

                          <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px dashed rgba(59, 130, 246, 0.2)' }}>
                             <div className="flex-items-center" style={{ gap: '8px', marginBottom: '8px' }}>
                                <Zap size={14} color="#3b82f6" />
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6' }}>AI Cognitive Hint</span>
                             </div>
                             <p style={{ fontSize: '11px', opacity: 0.6, lineHeight: '1.4' }}>
                                {selectedNode.type === 'trigger' ? "Define the specific data event that wakes up the agent." : 
                                 selectedNode.type === 'condition' ? "The agent will use its LLM to evaluate this logic gate." : 
                                 "The agent will execute a specific API call or tool based on this step."}
                             </p>
                          </div>

                          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                             <button className="btn-secondary" style={{ flex: 1 }} onClick={() => {
                                setWorkflowNodes(workflowNodes.filter(n => n.id !== selectedNode.id));
                                setSelectedNode(null);
                             }}>Delete Node</button>
                             <button className="btn-primary" style={{ flex: 2 }} onClick={() => setSelectedNode(null)}>Save Logic</button>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
         )}

         {activeTab === 'Knowledge' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="flex-between">
                 <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Knowledge Base</h2>
                    <p className="text-sm" style={{ opacity: 0.5 }}>Ingest documents to boost agent memory and cognition</p>
                 </div>
                 <button className="btn-primary flex-items-center" style={{ gap: '8px' }} onClick={() => setIsAddDataModalOpen(true)}>
                    <Plus size={16} /> Add data
                 </button>
              </div>              <div className="stat-card" style={{ padding: '0' }}>
                 <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', gap: '16px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                       <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                       <input 
                         placeholder="Search files by name..." 
                         style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '10px 12px 10px 36px', fontSize: '13px', outline: 'none' }} 
                       />
                    </div>
                    <button className="btn-secondary flex-items-center" style={{ gap: '8px', fontSize: '12px' }}>
                       <Filter size={14} /> Status
                    </button>
                    <button className="btn-secondary" style={{ padding: '10px' }}><Layout size={14} /></button>
                 </div>

                 {knowledgeItems.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {knowledgeItems.map((item, i) => (
                        <div key={item.id} style={{ padding: '20px 24px', borderBottom: i === knowledgeItems.length - 1 ? 'none' : '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <FileText size={20} style={{ opacity: 0.5 }} />
                              </div>
                              <div>
                                 <h4 style={{ fontSize: '14px', fontWeight: '700' }}>{item.file_name}</h4>
                                 <p style={{ fontSize: '11px', opacity: 0.4 }}>{(item.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(item.created_at).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '11px' }}>Delete</button>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 24px', textAlign: 'center' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                         <BookOpen size={24} style={{ opacity: 0.4 }} />
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>This agent currently has no memory</h3>
                      <p className="text-sm" style={{ opacity: 0.5, marginBottom: '24px', maxWidth: '400px' }}>Boost your agent's capabilities by incorporating relevant data into its memory. The agent will use this data during task execution.</p>
                      <button className="btn-primary" onClick={() => setIsAddDataModalOpen(true)}>Add data</button>
                   </div>
                  )}
               </div>
            </div>
          )}

         {/* CONFIGURATIONS TAB (WIRED TO SAMPLES) */}
          {activeTab === 'Notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div className="flex-between">
                  <div>
                     <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Agent Notifications</h2>
                     <p className="text-sm" style={{ opacity: 0.5 }}>Logs, reports, and real-time alerts specific to {agentName}</p>
                  </div>
                  <button className="btn-secondary flex-items-center" style={{ gap: '8px' }}>
                     <CheckCircle2 size={16} /> Mark all read
                  </button>
               </div>

               <div className="stat-card" style={{ padding: '0' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-main)', display: 'flex', gap: '16px' }}>
                     <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        <input 
                          placeholder="Search agent logs..." 
                          style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '10px 12px 10px 36px', fontSize: '13px', outline: 'none' }} 
                        />
                     </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {notifications.length === 0 ? (
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
                         <Bell size={32} style={{ opacity: 0.2, marginBottom: '16px' }} />
                         <p style={{ opacity: 0.4, fontSize: '14px' }}>No notifications yet. Agent activity will appear here when tasks are executed.</p>
                       </div>
                     ) : notifications.map((log, i) => (
                        <div key={i} style={{ padding: '20px 24px', borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: log.status === 'Unread' ? '#3b82f6' : 'transparent', border: log.status === 'Unread' ? 'none' : '1px solid var(--border-main)' }} />
                              <div>
                                 <span className="uppercase-label" style={{ fontSize: '9px', fontWeight: '800', opacity: 0.5 }}>{log.type}</span>
                                 <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{log.title}</h4>
                              </div>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{log.time}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

         {activeTab === 'Configurations' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                 <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>Configuration</h2>
                 <p className="text-sm" style={{ opacity: 0.5 }}>Configure your agent's tools, workflows and general settings</p>
              </div>

              {/* Sub-navigation */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--border-main)' }}>
                 {configTabs.map(ct => (
                   <button 
                     key={ct}
                     onClick={() => setActiveConfigTab(ct)}
                     style={{ 
                       padding: '8px 24px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600',
                       background: activeConfigTab === ct ? 'rgba(255,255,255,0.08)' : 'transparent',
                       color: activeConfigTab === ct ? 'white' : 'var(--text-dim)',
                       cursor: 'pointer', transition: 'all 0.2s'
                     }}
                   >
                     {ct}
                   </button>
                 ))}
              </div>

              <div className="stat-card" style={{ padding: '32px' }}>
                 
                 {activeConfigTab === 'Settings' && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div>
                         <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Basic</h3>
                         <p className="text-sm" style={{ opacity: 0.5, marginBottom: '24px' }}>Give your agent a name, description and an avatar</p>
                         
                         <div style={{ padding: '16px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.1)', display: 'flex', gap: '16px', marginBottom: '32px' }}>
                            <Info size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                               Define your agent's identity by assigning a name and function. A clearly specified role streamlines operations and ensures the agent meets specific requirements.
                            </p>
                         </div>

                         <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                               <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Name*</label>
                               <input defaultValue={agentName} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '12px 16px', color: 'white', outline: 'none' }} />
                            </div>
                            <div>
                               <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Description</label>
                               <textarea 
                                 rows={4} 
                                 defaultValue={`This agent handles high-level ${currentConfig.role} tasks for the department. It monitors active data streams and executes specialized logic patterns to ensure operational autonomy.`}
                                 style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '12px', padding: '12px 16px', color: 'white', outline: 'none', resize: 'none' }} 
                               />
                            </div>
                            <div>
                               <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Category</label>
                               <select style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '12px 16px', color: 'white', outline: 'none' }}>
                                  <option>Finance & Accounting</option>
                                  <option>Ops & Scheduling</option>
                                  <option>Legal & Compliance</option>
                               </select>
                            </div>
                            <div>
                               <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>Avatar</label>
                               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                     <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #2563EB, #7c3aed)', opacity: 0.8 }} />
                                  </div>
                                  <button className="btn-secondary" style={{ fontSize: '12px' }}>Change Image</button>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 {activeConfigTab === 'Memory' && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div>
                         <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Memory Hub</h3>
                         <p className="text-sm" style={{ opacity: 0.5, marginBottom: '24px' }}>Boost your agent's capabilities by incorporating relevant data into its memory.</p>
                         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                            <Database size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                            <p style={{ opacity: 0.4, marginBottom: '20px', fontSize: '13px' }}>No memory blocks found. Add data to begin.</p>
                            <button className="btn-primary" onClick={() => setIsAddDataModalOpen(true)}>Add data</button>
                         </div>
                      </div>
                   </div>
                 )}

                 {activeConfigTab === 'Interface' && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div>
                         <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Deployment</h3>
                         <p className="text-sm" style={{ opacity: 0.5, marginBottom: '32px' }}>Customise and manage your agent's deployment settings here.</p>
                         
                         <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>Deploy agent</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                               <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>https://app.beam.ai/public/chat/c48b6142-113c-4053-91ac-2306419db18c?apiKey=[API_KEY]</span>
                                  <Copy size={14} style={{ cursor: 'pointer' }} />
                               </div>
                               <div className="flex-items-center" style={{ gap: '12px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '600' }}>{isActivated ? 'Active' : 'Inactive'}</span>
                                  <div 
                                    onClick={() => setIsActivated(!isActivated)}
                                    style={{ width: '40px', height: '20px', borderRadius: '100px', background: isActivated ? '#2563EB' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s' }}
                                  >
                                     <div style={{ position: 'absolute', top: '2px', left: isActivated ? '22px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'all 0.3s' }} />
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>API Keys</label>
                            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
                               <input placeholder="Label name" style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '10px 12px', color: 'white', outline: 'none', marginBottom: '16px', fontSize: '13px' }} />
                               <button className="btn-secondary" style={{ fontSize: '12px' }}>Create new API key</button>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 {activeConfigTab === 'Integrations' && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div>
                         <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Google Sheets Ledger</h3>
                         <p className="text-sm" style={{ opacity: 0.5, marginBottom: '24px' }}>Provide the Spreadsheet ID for the Financial Controller to manage your transactions and reporting.</p>
                         
                         <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)', display: 'flex', gap: '16px', marginBottom: '32px' }}>
                            <Info size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                               The ID is the long string of letters and numbers in your Google Sheets URL. For example: <br />
                               <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>https://docs.google.com/spreadsheets/d/<b>[THIS_IS_THE_ID]</b>/edit</code>
                            </p>
                         </div>

                         <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                               <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Spreadsheet ID</label>
                               <input 
                                 value={ledgerSheetId}
                                 onChange={(e) => {
                                   setLedgerSheetId(e.target.value);
                                   localStorage.setItem(`ledger_${agentId}_v2`, e.target.value);
                                 }}
                                 placeholder="e.g. 1BxiMVs0XRYFgwnTE9a3qX"
                                 style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '12px 16px', color: 'white', outline: 'none' }} 
                               />
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Footer Actions */}
                 <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border-main)' }}>
                    <button className="btn-secondary">Discard changes</button>
                    <button className="btn-primary" style={{ padding: '12px 32px' }}>Save</button>
                 </div>

              </div>
           </div>
         )}

         {/* ANALYTICS TAB (HIGH-FIDELITY) */}
         {activeTab === 'Analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
               <div className="flex-between">
                  <div>
                     <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Intelligence Dashboard</h2>
                     <p className="text-sm" style={{ opacity: 0.5 }}>Real-time performance metrics and neural health tracking</p>
                  </div>
                  <div className="flex-items-center" style={{ gap: '12px' }}>
                     <button className="btn-secondary flex-items-center" style={{ gap: '8px', fontSize: '12px' }}>
                        <Cloud size={14} /> Export Data
                     </button>
                     <select className="btn-secondary" style={{ fontSize: '12px', background: 'var(--border-main)', padding: '8px 16px' }}>
                        <option>Last 30 Days</option>
                        <option>Last 7 Days</option>
                        <option>Last 24 Hours</option>
                     </select>
                  </div>
               </div>

               {/* Sub-tab Navigation */}
               <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-main)', paddingBottom: '4px' }}>
                  {['Neural Health', 'Weekly Report'].map(subTab => (
                     <button
                        key={subTab}
                        onClick={() => setAnalyticsSubTab(subTab)}
                        style={{
                           padding: '12px 16px',
                           background: 'transparent',
                           border: 'none',
                           borderBottom: analyticsSubTab === subTab ? '2px solid #3b82f6' : '2px solid transparent',
                           color: analyticsSubTab === subTab ? '#3b82f6' : 'var(--text-muted)',
                           fontWeight: analyticsSubTab === subTab ? '700' : '500',
                           fontSize: '13px',
                           cursor: 'pointer',
                           transition: 'all 0.2s ease',
                           marginBottom: '-1px'
                        }}
                     >
                        {subTab}
                     </button>
                  ))}
               </div>

               {analyticsSubTab === 'Neural Health' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                     {/* Metric Cards */}
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                       {[
                         { label: 'Logic Accuracy', value: '98.4%', trend: '+2.1%', icon: BrainCircuit, color: '#3b82f6' },
                         { label: 'Tasks Automated', value: tasks.length.toString(), trend: '+1', icon: Zap, color: '#10b981' },
                         { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'Completed').length.toString(), trend: '+1', icon: Clock, color: '#f59e0b' },
                         { label: 'Resource Efficiency', value: '92%', trend: '+5%', icon: ShieldCheck, color: '#8b5cf6' },
                       ].map((stat, i) => {
                          const Icon = stat.icon;
                          return (
                            <div key={i} className="stat-card" style={{ padding: '24px' }}>
                               <div className="flex-between" style={{ marginBottom: '16px' }}>
                                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                                     <Icon size={20} />
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981' }}>{stat.trend}</span>
                               </div>
                               <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', marginBottom: '4px' }}>{stat.label}</p>
                               <p style={{ fontSize: '28px', fontWeight: '800' }}>{stat.value}</p>
                            </div>
                          );
                       })}
                     </div>

                     {/* Performance Chart & Grounding Heatmap */}
                     <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
                        <div className="stat-card" style={{ minHeight: '400px', padding: '32px' }}>
                           <div className="flex-between" style={{ marginBottom: '32px' }}>
                              <div>
                                 <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Neural Execution Trends</h3>
                                 <p className="text-sm" style={{ opacity: 0.5 }}>Daily task volume vs completion speed</p>
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                 <div className="flex-items-center" style={{ gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Volume</span>
                                 </div>
                                 <div className="flex-items-center" style={{ gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Accuracy</span>
                                 </div>
                              </div>
                           </div>
                           <div style={{ height: '240px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative' }}>
                              {[45, 60, 40, 85, 70, 95, 80, 100, 75, 90, 85, 95].map((h, i) => (
                                <div key={i} style={{ flex: 1, position: 'relative', height: '100%' }}>
                                   <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${h}%`, background: i === 11 ? 'linear-gradient(to top, #3b82f6, #60a5fa)' : 'rgba(255,255,255,0.03)', borderRadius: '4px 4px 0 0', transition: 'all 0.3s ease' }} />
                                   {i > 0 && (
                                     <div style={{ position: 'absolute', bottom: `${h-2}%`, left: '-50%', width: '100%', height: '2px', background: '#10b981', opacity: 0.5, borderRadius: '2px' }} />
                                   )}
                                </div>
                              ))}
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', padding: '0 4px' }}>
                              {['01', '05', '10', '15', '20', '25', '30'].map(d => (
                                <span key={d} style={{ fontSize: '10px', opacity: 0.4 }}>MAY {d}</span>
                              ))}
                           </div>
                        </div>

                        <div className="stat-card" style={{ padding: '32px' }}>
                           <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Grounding Utilization</h3>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {currentConfig.grounding.map((source: string, i: number) => {
                                const percentages = [85, 65, 45, 30, 20];
                                const p = percentages[i] || 15;
                                return (
                                  <div key={source}>
                                     <div className="flex-between" style={{ marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', opacity: 0.6 }}>{source}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '700' }}>{p}%</span>
                                     </div>
                                     <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '100px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${p}%`, background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', borderRadius: '100px' }} />
                                     </div>
                                  </div>
                                );
                              })}
                           </div>
                           
                           <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
                              <div className="flex-items-center" style={{ gap: '10px', marginBottom: '12px' }}>
                                 <Shield size={16} color="#10b981" />
                                 <span style={{ fontSize: '12px', fontWeight: '800' }}>Trust Score</span>
                              </div>
                              <p style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>9.8 <span style={{ fontSize: '12px', opacity: 0.4 }}>/ 10</span></p>
                              <p style={{ fontSize: '11px', opacity: 0.5 }}>High confidence grounding across all {currentConfig.grounding.length} sources.</p>
                           </div>
                        </div>
                     </div>

                     {/* Logic Execution Logs */}
                     <div className="stat-card" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Neural Execution Logs</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-main)', borderRadius: '8px', overflow: 'hidden' }}>
                           {tasks.slice(0, 4).map((task, i) => (
                             <div key={i} className="flex-between" style={{ background: '#02040a', padding: '16px 24px', fontSize: '13px' }}>
                                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                   <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.4 }}>{task.deadline || 'Today'}</span>
                                   <span style={{ fontWeight: '700' }}>{task.title}</span>
                                   <div style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', fontSize: '11px', opacity: 0.6 }}>{task.status}</div>
                                </div>
                                <div className="flex-items-center" style={{ gap: '24px' }}>
                                   <span style={{ fontSize: '11px', fontWeight: '800', color: task.status === 'Completed' ? '#10b981' : task.status === 'Pending' ? '#f59e0b' : '#3b82f6' }}>{task.status === 'Completed' ? 'Success' : task.status}</span>
                                   <span style={{ fontSize: '11px', opacity: 0.4 }}>99% Conf.</span>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               {analyticsSubTab === 'Weekly Report' && (
                  <WeeklyReportView
                     weeklyReports={weeklyReports}
                     selectedReport={selectedReport}
                     setSelectedReport={setSelectedReport}
                     isGeneratingReport={isGeneratingReport}
                     onGenerateReport={() => handleGenerateWeeklyReport(false)}
                  />
               )}
            </div>
         )}

         {/* REAL WORLD DATA TAB (REFINED) */}
         {activeTab === 'Real World Data' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className="flex-between">
                 <div>
                    <h3 className="uppercase-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Grounding Sources</h3>
                    <p className="text-sm" style={{ opacity: 0.5 }}>Connect external platforms to provide real-time context to your agent</p>
                 </div>
                 <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary flex-items-center" style={{ gap: '8px', fontSize: '12px' }}>
                       <RotateCcw size={14} /> Refresh All
                    </button>
                    <button className="btn-primary flex-items-center" style={{ gap: '8px', fontSize: '12px' }}>
                       <Plus size={14} /> Add Source
                    </button>
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
                 {allSources.filter(s => currentConfig.grounding.includes(s.name)).map((source) => {
                   const Icon = source.icon;
                   const state = connectionStates[source.name] || (source.name === 'Notion' ? 'connected' : 'unconnected');
                   
                   const handleConnect = async () => {
                     const triggerModalServices = ['Gmail', 'Google Calendar', 'Microsoft Outlook'];
                     if (triggerModalServices.includes(source.name)) {
                        if (source.name === 'Gmail' || source.name === 'Google Calendar') {
                           const { error } = await supabase.auth.signInWithOAuth({
                              provider: 'google',
                              options: {
                                 scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets',
                                 redirectTo: window.location.origin + window.location.pathname
                              }
                           });
                           if (error) console.error("OAuth error:", error);
                        } else {
                           setConnectingService(source.name);
                           setIsConnectModalOpen(true);
                        }
                     } else {
                        setConnectionStates(prev => ({ ...prev, [source.name]: 'connecting' }));
                        setTimeout(() => {
                           setConnectionStates(prev => ({ ...prev, [source.name]: 'connected' }));
                        }, 2500);
                     }
                   };

                   return (
                     <div key={source.name} className="stat-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div className="flex-between" style={{ marginBottom: '20px' }}>
                           <div className="flex-items-center" style={{ gap: '16px' }}>
                              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: state === 'connected' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: state === 'connected' ? '#10b981' : 'white' }}>
                                 <Icon size={24} />
                              </div>
                              <div>
                                 <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{source.name}</h4>
                                 <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{source.category}</p>
                              </div>
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <div style={{ padding: '4px 8px', borderRadius: '6px', background: state === 'connected' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: state === 'connected' ? '#10b981' : 'var(--text-dim)', fontSize: '9px', fontWeight: '800', letterSpacing: '0.05em' }}>
                                 {state.toUpperCase()}
                              </div>
                           </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px', lineHeight: '1.5' }}>{source.desc}</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                           {state === 'connected' ? (
                             <>
                               <button className="btn-secondary" style={{ flex: 1, fontSize: '11px' }}>Manage</button>
                               <button className="btn-secondary" style={{ padding: '10px' }}><RotateCcw size={14} /></button>
                             </>
                           ) : (
                             <button 
                               onClick={handleConnect}
                               disabled={state === 'connecting'}
                               className={state === 'connecting' ? 'btn-secondary' : 'btn-primary'} 
                               style={{ flex: 1, fontSize: '12px', height: '38px' }}
                             >
                               {state === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : 'Connect Source'}
                             </button>
                           )}
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
         )}

      </div>

      {/* CONNECT MODAL */}
      {isConnectModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
           <div className="stat-card animate-zoom-in" style={{ width: '100%', maxWidth: '480px', padding: '40px', background: '#02040a', border: '1px solid var(--border-main)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', marginBottom: '24px', margin: '0 auto 24px' }}>
                 <Globe size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', textAlign: 'center', marginBottom: '8px' }}>Connect {connectingService}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '32px' }}>AgentCore needs permission to read and manage your {connectingService} data to execute autonomous workflows.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                 <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#3b82f6' }}>AR</div>
                    <div style={{ flex: 1 }}>
                       <p style={{ fontSize: '14px', fontWeight: '700' }}>Ahmed Rakib</p>
                       {isEditingEmail ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                           <input 
                             value={connectEmail} 
                             onChange={(e) => setConnectEmail(e.target.value)} 
                             style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #3b82f6', borderRadius: '4px', padding: '4px 8px', color: 'white', fontSize: '12px', outline: 'none', width: '100%' }}
                             autoFocus
                           />
                           <button onClick={() => setIsEditingEmail(false)} style={{ background: '#3b82f6', border: 'none', borderRadius: '4px', padding: '4px 8px', color: 'white', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                         </div>
                       ) : (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <p style={{ fontSize: '12px', opacity: 0.5 }}>{connectEmail}</p>
                           <button onClick={() => setIsEditingEmail(true)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                         </div>
                       )}
                    </div>
                    <CheckCircle2 size={20} color="#10b981" style={{ marginLeft: 'auto' }} />
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                 <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsConnectModalOpen(false)}>Cancel</button>
                 <button className="btn-primary" style={{ flex: 2 }} onClick={handleAllowAccess}>Allow Access</button>
              </div>
           </div>
        </div>
      )}

      {/* ADD DATA MODAL */}
      {isAddDataModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
           <div className="stat-card" style={{ width: '100%', maxWidth: '600px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex-between" style={{ marginBottom: '32px' }}>
                 <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Ingest Knowledge</h2>
                    <p className="text-sm" style={{ opacity: 0.5 }}>Upload documents to train your agent's neural memory</p>
                 </div>
                 <button onClick={() => setIsAddDataModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <X size={24} />
                 </button>
              </div>

              {!isUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   {/* Drop Zone */}
                   <div 
                     style={{ height: '220px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'rgba(255,255,255,0.01)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                     onDragOver={(e) => e.preventDefault()}
                     onClick={() => handleAddKnowledge('Financial_Audit_Q3.pdf')}
                   >
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                         <AttachmentIcon size={24} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                         <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Click or drag file to this area to upload</p>
                         <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Support for PDF, CSV, TXT, DOCX (Max 25MB)</p>
                      </div>
                   </div>

                   {/* External Connectors */}
                   <div>
                      <h4 className="uppercase-label" style={{ fontSize: '10px', marginBottom: '16px' }}>Or connect cloud storage</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                         {[
                           { name: 'Google Drive', icon: Globe },
                           { name: 'OneDrive', icon: Cloud },
                           { name: 'Dropbox', icon: Package }
                         ].map((cloud) => (
                           <button key={cloud.name} className="btn-secondary flex-items-center" style={{ gap: '8px', fontSize: '11px', justifyContent: 'center' }}>
                              {cloud.name}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddDataModalOpen(false)}>Cancel</button>
                      <button className="btn-primary" style={{ flex: 2 }}>Ingest Memory</button>
                   </div>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                   <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 32px' }}>
                      <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                         <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                         <circle cx="60" cy="60" r="54" fill="none" stroke="#2563EB" strokeWidth="8" strokeDasharray={339} strokeDashoffset={339 - (339 * uploadProgress) / 100} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800' }}>
                         {uploadProgress}%
                      </div>
                   </div>
                   <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Ingesting Neural Memory...</h3>
                   <p className="text-sm" style={{ opacity: 0.5 }}>Your agent is reading, indexing, and vectorizing the data.</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {isCreateTaskModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
           <div className="stat-card" style={{ width: '100%', maxWidth: '500px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                 <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Create New Mission</h2>
                 <button onClick={() => setIsCreateTaskModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <X size={20} />
                 </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, display: 'block', marginBottom: '8px' }}>Mission Objective</label>
                    <input 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Audit Q3 Expense Reports"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '12px', color: 'white', outline: 'none' }}
                    />
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                       <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, display: 'block', marginBottom: '8px' }}>Priority</label>
                       <select 
                         value={newTaskPriority}
                         onChange={(e) => setNewTaskPriority(e.target.value)}
                         style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '12px', color: 'white', outline: 'none' }}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                       </select>
                    </div>
                    <div>
                       <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, display: 'block', marginBottom: '8px' }}>Execution Mode</label>
                       <select 
                         value={newTaskType}
                         onChange={(e) => setNewTaskType(e.target.value)}
                         style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '12px', color: 'white', outline: 'none' }}>
                          <option>Autonomous</option>
                          <option>Human-Verified</option>
                       </select>
                    </div>
                 </div>

                 <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    <div className="flex-items-center" style={{ gap: '10px', marginBottom: '4px' }}>
                       <Info size={14} color="#3b82f6" />
                       <span style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>Agent Grounding Active</span>
                    </div>
                    <p style={{ fontSize: '11px', opacity: 0.6 }}>This task will utilize data from {currentConfig.grounding.slice(0, 2).join(', ')} and {currentConfig.grounding.length - 2} more sources.</p>
                 </div>

                 <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsCreateTaskModalOpen(false)}>Cancel</button>
                    <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreateTask}>Launch Mission</button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
