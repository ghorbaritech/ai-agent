import React from 'react';
import { RotateCcw, Loader2, Clock, Cloud } from 'lucide-react';

interface WeeklyReportViewProps {
  weeklyReports: any[];
  selectedReport: any | null;
  setSelectedReport: (report: any) => void;
  isGeneratingReport: boolean;
  onGenerateReport: () => void;
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  weeklyReports,
  selectedReport,
  setSelectedReport,
  isGeneratingReport,
  onGenerateReport
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Summary Header */}
      <div className="flex-between" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-main)', padding: '20px 24px', borderRadius: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Executive Summary & Email Insights</h3>
          <p className="text-sm" style={{ opacity: 0.5 }}>
            {weeklyReports.length > 0 && selectedReport
              ? `Weekly report compiled for ${new Date(selectedReport.start_date).toLocaleDateString()} - ${new Date(selectedReport.end_date).toLocaleDateString()}` 
              : 'No weekly reports generated yet.'}
          </p>
        </div>
        <button 
          onClick={onGenerateReport} 
          className="btn-primary flex-items-center" 
          disabled={isGeneratingReport}
          style={{ gap: '8px', padding: '12px 24px', borderRadius: '10px' }}
        >
          {isGeneratingReport ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing Inbox...
            </>
          ) : (
            <>
              <RotateCcw size={16} />
              Generate Report Now
            </>
          )}
        </button>
      </div>

      {weeklyReports.length === 0 ? (
        <div className="stat-card" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' }}>
          <Clock size={40} style={{ opacity: 0.3 }} />
          <div>
            <h4 style={{ fontWeight: '700', fontSize: '15px' }}>No Reports Generated Yet</h4>
            <p className="text-sm" style={{ opacity: 0.5, marginTop: '4px' }}>Generate your first weekly report to aggregate email statistics and extract action plans.</p>
          </div>
          <button 
            onClick={onGenerateReport} 
            className="btn-primary"
            disabled={isGeneratingReport}
            style={{ padding: '10px 20px', borderRadius: '8px' }}
          >
            {isGeneratingReport ? 'Generating...' : 'Analyze Emails Now'}
          </button>
        </div>
      ) : (
        <>
          {/* High-Fidelity Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {[
              { label: 'Emails Received', value: selectedReport?.received_count || 0, color: '#3b82f6', desc: 'Total messages received' },
              { label: 'Emails Read', value: selectedReport?.read_count || 0, color: '#10b981', desc: 'Processed & read' },
              { label: 'Emails Unread', value: selectedReport?.unread_count || 0, color: '#ef4444', desc: 'Pending review' },
              { label: 'Emails Replied', value: selectedReport?.replied_count || 0, color: '#f59e0b', desc: 'Replied/actions taken' }
            ].map((stat, i) => (
              <div key={i} className="stat-card" style={{ padding: '24px', border: '1px solid var(--border-main)' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', marginBottom: '8px' }}>{stat.label}</p>
                <div className="flex-between" style={{ alignItems: 'baseline' }}>
                  <p style={{ fontSize: '32px', fontWeight: '800', color: stat.color }}>{stat.value}</p>
                  <span style={{ fontSize: '10px', opacity: 0.4 }}>{stat.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Dashboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '32px', alignItems: 'start' }}>
            
            {/* Left Column: Report Markdown & Key Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Markdown Content Card */}
              <div className="stat-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', borderBottom: '1px solid var(--border-main)', paddingBottom: '16px' }}>Summary Report</h4>
                <div 
                  style={{ fontSize: '14px', lineHeight: '1.7', color: '#cbd5e1' }}
                  className="markdown-body"
                >
                  {(() => {
                    const text = selectedReport?.report_text;
                    if (typeof text !== 'string') return null;

                    // Simple inline parser for **bold** text
                    const parseInline = (line: string) => {
                      const parts = line.split(/\*\*([^*]+)\*\*/g);
                      return parts.map((part, idx) => {
                        if (idx % 2 === 1) {
                          return <strong key={idx} style={{ color: '#ffffff', fontWeight: '700' }}>{part}</strong>;
                        }
                        return part;
                      });
                    };

                    const lines = text.split('\n');
                    const elements: React.ReactNode[] = [];
                    let currentList: React.ReactNode[] = [];

                    const flushList = () => {
                      if (currentList.length > 0) {
                        elements.push(
                          <ul key={`list-${elements.length}`} style={{ paddingLeft: '20px', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {currentList}
                          </ul>
                        );
                        currentList = [];
                      }
                    };

                    lines.forEach((line, index) => {
                      const trimmed = line.trim();

                      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
                        const content = trimmed.startsWith('* ') || trimmed.startsWith('- ') 
                          ? trimmed.substring(2) 
                          : trimmed.replace(/^\d+\.\s/, '');
                        currentList.push(
                          <li key={`li-${index}`} style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                            {parseInline(content)}
                          </li>
                        );
                      } else {
                        flushList();

                        if (trimmed.startsWith('# ')) {
                          elements.push(
                            <h1 key={index} style={{ fontSize: '20px', fontWeight: '800', color: 'white', margin: '20px 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                              {parseInline(trimmed.substring(2))}
                            </h1>
                          );
                        } else if (trimmed.startsWith('## ')) {
                          elements.push(
                            <h2 key={index} style={{ fontSize: '16px', fontWeight: '700', color: 'white', margin: '16px 0 8px 0' }}>
                              {parseInline(trimmed.substring(3))}
                            </h2>
                          );
                        } else if (trimmed.startsWith('### ')) {
                          elements.push(
                            <h3 key={index} style={{ fontSize: '14px', fontWeight: '600', color: 'white', margin: '12px 0 6px 0' }}>
                              {parseInline(trimmed.substring(4))}
                            </h3>
                          );
                        } else if (trimmed.startsWith('>')) {
                          const content = trimmed.substring(1).trim();
                          elements.push(
                            <div 
                              key={index} 
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.05)', 
                                borderLeft: '4px solid #ef4444', 
                                padding: '12px 16px', 
                                borderRadius: '0 8px 8px 0', 
                                margin: '16px 0',
                                fontSize: '13px',
                                color: '#f87171'
                              }}
                            >
                              {parseInline(content)}
                            </div>
                          );
                        } else if (trimmed === '') {
                          elements.push(<div key={index} style={{ height: '8px' }} />);
                        } else {
                          elements.push(
                            <p key={index} style={{ margin: '6px 0', color: '#cbd5e1', lineHeight: '1.6' }}>
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
              </div>

              {/* Action Plan Checklist */}
              <div className="stat-card" style={{ padding: '32px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>Recommended Actions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedReport?.actions?.map((act: any, idx: number) => (
                    <div key={idx} className="flex-items-center" style={{ gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-main)' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f620', border: '1px solid #3b82f6', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                        {idx + 1}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>{act.action}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{act.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: History Selector & Email Breakdowns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Report History Panel */}
              <div className="stat-card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>History Logs</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                  {weeklyReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        background: selectedReport?.id === report.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                        border: selectedReport?.id === report.id ? '1px solid #3b82f6' : '1px solid var(--border-main)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Report #{report.id.toString().slice(0, 5)}</span>
                        <span style={{ opacity: 0.5 }}>{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Most Important Emails */}
              <div className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Most Important Emails</h4>
                {selectedReport?.important_emails?.map((email: any, i: number) => (
                  <div key={i} style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', fontSize: '12px' }}>
                    <p style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '2px' }}>{email.subject}</p>
                    <p style={{ fontSize: '10px', opacity: 0.5, marginBottom: '6px' }}>From: {email.from}</p>
                    <p style={{ opacity: 0.7, marginBottom: '8px', fontStyle: 'italic' }}>"{email.snippet}"</p>
                    <p style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}><strong>EA Reason:</strong> {email.reason}</p>
                  </div>
                ))}
              </div>

              {/* Emails Needing Attention */}
              <div className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Needs Attention</h4>
                {selectedReport?.need_attention?.map((email: any, i: number) => (
                  <div key={i} style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', fontSize: '12px' }}>
                    <p style={{ fontWeight: '700', color: '#f87171', marginBottom: '2px' }}>{email.subject}</p>
                    <p style={{ fontSize: '10px', opacity: 0.5, marginBottom: '6px' }}>From: {email.from}</p>
                    <p style={{ opacity: 0.7, marginBottom: '8px', fontStyle: 'italic' }}>"{email.snippet}"</p>
                    <p style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}><strong>EA Reason:</strong> {email.reason}</p>
                  </div>
                ))}
              </div>

            </div>

          </div>
        </>
      )}
    </div>
  );
};
export default WeeklyReportView;
