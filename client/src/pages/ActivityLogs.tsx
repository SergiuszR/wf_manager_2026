import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useProjectContext } from '../contexts/ProjectContext';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { getProjectActivityLogs, ActivityLog, deleteActivityLog } from '../services/activityLogService';

// Extend the User type locally to include webflowToken
interface UserWithWebflowToken extends SupabaseUser {
  webflowToken?: string;
  tokenName?: string;
}

// Icon and color helpers
const actionIcons: Record<string, string> = {
  update_alt_text: '✏️',
  edit_cms_item: '🗂️',
  create: '➕',
  delete: '🗑️',
};
const actionLabels: Record<string, string> = {
  update_alt_text: 'Edited ALT Text',
  edit_cms_item: 'Edited CMS Item',
  create: 'Created',
  delete: 'Deleted',
};
const actionColors: Record<string, string> = {
  update_alt_text: '#3b82f6', // blue
  edit_cms_item: '#6366f1', // indigo
  create: '#22c55e', // green
  delete: '#ef4444', // red
  upload_asset: '#f59e42', // orange
  delete_asset: '#e11d48', // dark red
  publish_site: '#0ea5e9', // cyan/blue
};
const entityIcons: Record<string, string> = {
  asset: '🖼️',
  cms_item: '📄',
};

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString();
}

const ActivityLogs: React.FC = () => {
  const { token, user: rawUser } = useAuth();
  const user = rawUser as UserWithWebflowToken | null;
  const { projects, selectedProject, setSelectedProject, loading: projectsLoading } = useProjectContext();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const logsPerPage = 50;

  // Toast state for notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (selectedProject?.id) {
      setPage(1);
      setLogs([]);
      fetchLogs(selectedProject.id, 1);
    }
  }, [selectedProject?.id]);

  const fetchLogs = async (projectId: string, pageNum: number) => {
    setLoading(true);
    setError('');
    try {
      const fetchedLogs = await getProjectActivityLogs(projectId, logsPerPage, pageNum);
      if (pageNum === 1) {
        setLogs(fetchedLogs);
      } else {
        setLogs(prev => [...prev, ...fetchedLogs]);
      }
      setHasMore(fetchedLogs.length === logsPerPage);
      setPage(pageNum);
    } catch (err) {
      setError('Failed to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore && selectedProject?.id) {
      fetchLogs(selectedProject.id, page + 1);
    }
  };

  const getEntityUrl = (log: ActivityLog) => {
    if (!selectedProject?.id) return null;
    if (log.entity_type === 'asset') {
      return `/assets?project=${selectedProject.id}&highlight=${log.entity_id}`;
    } else if (log.entity_type === 'cms_item') {
      const collectionId = log.new_data?._collection_id || log.previous_data?._collection_id;
      if (collectionId) {
        return `/cms?project=${selectedProject.id}&collection=${collectionId}&item=${log.entity_id}`;
      }
    }
    return null;
  };

  const formatLogDetails = (log: ActivityLog) => {
    if (log.action_type === 'update_alt_text') {
      const prevAlt = log.previous_data?.altText || '';
      const newAlt = log.new_data?.altText || '';
      return (
        <DetailsList>
          <Detail><DetailLabel>Previous:</DetailLabel><DetailValue>{prevAlt.trim() ? prevAlt : <EmptyValue>Not set</EmptyValue>}</DetailValue></Detail>
          <Detail><DetailLabel>New:</DetailLabel><DetailValue>{newAlt.trim() ? newAlt : <EmptyValue>Not set</EmptyValue>}</DetailValue></Detail>
        </DetailsList>
      );
    }
    if (log.action_type === 'edit_cms_item') {
      const editedFields = [];
      for (const key in log.new_data) {
        if (key.startsWith('_')) continue;
        const prevValue = log.previous_data?.[key];
        const newValue = log.new_data[key];
        if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
          editedFields.push(key);
        }
      }
      if (editedFields.length > 0) {
        return (
          <DetailsList>
            <Detail><DetailLabel>Changed Fields:</DetailLabel><DetailValue>{editedFields.join(', ')}</DetailValue></Detail>
          </DetailsList>
        );
      }
    }
    return null;
  };

  // Filtering
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      search === '' ||
      (log.action_type && actionLabels[log.action_type]?.toLowerCase().includes(search.toLowerCase())) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(search.toLowerCase())) ||
      (log.new_data?.name && log.new_data.name.toLowerCase().includes(search.toLowerCase())) ||
      (log.new_data?.title && log.new_data.title.toLowerCase().includes(search.toLowerCase()));
    const matchesAction = !actionFilter || log.action_type === actionFilter;
    const matchesEntity = !entityFilter || log.entity_type === entityFilter;
    return matchesSearch && matchesAction && matchesEntity;
  });

  // Helper to prettify action labels
  const prettifyLabel = (label: string) => label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Are you sure you want to permanently erase this log? This action cannot be undone.')) return;
    const ok = await deleteActivityLog(logId);
    if (ok) {
      setLogs(prev => prev.filter(l => l.id !== logId));
      showToast('Log erased successfully!', 'success');
    } else {
      showToast('Failed to erase log. Please try again.', 'error');
    }
  };

  // Premium check
  if (!user?.user_metadata?.premium) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>
        Activity logs are available only for premium users.
      </div>
    );
  }
  if (projects.length === 0) {
    return <div>Please add a project to access this section.</div>;
  }
  if (!selectedProject) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>Please select a project to continue.</div>;
  }

  return (
    <PageContainer>
      <ProjectSelectorContainer>
        <ProjectAccentBar />
        <ProjectLabel htmlFor="project-select">Project</ProjectLabel>
        <ProjectSelect
          id="project-select"
          value={selectedProject?.id || ''}
          onChange={e => {
            const proj = projects.find((p: any) => String(p.id) === e.target.value);
            setSelectedProject(proj || null);
          }}
          disabled={projects.length <= 1}
        >
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </ProjectSelect>
      </ProjectSelectorContainer>

      <PageHeader>
        <div>
          <PageTitle>Activity Logs</PageTitle>
          <PageDescription>Track changes made to your Webflow content</PageDescription>
        </div>
        <RefreshButton onClick={() => selectedProject?.id && fetchLogs(selectedProject.id, 1)} disabled={loading}>
          {loading ? <LoadingSpinner size="small" /> : <RefreshIcon>↻</RefreshIcon>}
          Refresh
        </RefreshButton>
      </PageHeader>

      {/* Filter/Search Bar */}
      <FilterBar>
        <SearchInput
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          {Object.entries(actionLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
        <Select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="">All Entities</option>
          <option value="asset">Asset</option>
          <option value="cms_item">CMS Item</option>
        </Select>
      </FilterBar>

      {loading && logs.length === 0 ? (
        <LoadingMessage>Loading activity logs...</LoadingMessage>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : filteredLogs.length === 0 ? (
        <NoDataMessage>No activity logs found for this project.</NoDataMessage>
      ) : (
        <TableWrapper>
          <StyledTable>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Item</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td><span>{new Date(log.created_at).toLocaleString()}</span></td>
                  <td>
                    <ActionBadge color={actionColors[log.action_type] || '#888'}>
                      {actionIcons[log.action_type] || '🔔'} {actionLabels[log.action_type] || prettifyLabel(log.action_type)}
                    </ActionBadge>
                  </td>
                  <td>
                    {log.action_type === 'publish_site' && log.entity_type === 'site' ? (
                      <EntityBadge>
                        <span style={{fontSize: '1.2em', marginRight: 6}}>🌐</span>
                        {log.new_data?.siteName || 'Site'}
                      </EntityBadge>
                    ) : (
                      <EntityBadge>
                        {log.entity_type === 'asset' && (log.new_data?.thumbnailUrl || log.new_data?.url) ? (
                          <ThumbImg
                            src={log.new_data.thumbnailUrl || log.new_data.url}
                            alt={log.new_data?.name || log.new_data?.fileName || 'Asset'}
                          />
                        ) : (
                          <span style={{fontSize: '1.2em', marginRight: 6}}>{entityIcons[log.entity_type] || '🔗'}</span>
                        )}
                        {log.new_data?.name || log.new_data?.title || (log.entity_type === 'asset' ? 'Asset' : 'CMS Item')}
                      </EntityBadge>
                    )}
                  </td>
                  <td style={{ position: 'relative', paddingRight: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>{formatLogDetails(log)}</div>
                      <DeleteButton onClick={() => handleDeleteLog(log.id)} title="Erase log">🗑️</DeleteButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
          {hasMore && (
            <LoadMoreContainer>
              <LoadMoreButton onClick={loadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </LoadMoreButton>
            </LoadMoreContainer>
          )}
        </TableWrapper>
      )}

      {toast && (
        <ToastContainer type={toast.type}>{toast.message}</ToastContainer>
      )}
    </PageContainer>
  );
};

// Styled components (additions and overrides)
const FilterBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;
const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1.2px solid var(--border-color);
  background: var(--background-main);
  color: var(--text-primary);
  font-size: 1rem;
  min-width: 200px;
`;
const Select = styled.select`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1.2px solid var(--border-color);
  background: var(--background-main);
  color: var(--text-primary);
  font-size: 1rem;
`;
const TableWrapper = styled.div`
  overflow-x: auto;
`;
const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--background-light);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  th, td {
    padding: 0.7rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    vertical-align: top;
    background: transparent;
  }
  th {
    background: var(--background-main);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.98rem;
    border-bottom: 2px solid var(--border-color);
  }
  tr:last-child td {
    border-bottom: none;
  }
  tbody tr {
    transition: background 0.18s;
    &:hover {
      background: var(--background-secondary);
    }
  }
`;
const ActionBadge = styled.span<{ color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  background: ${props => props.color};
  color: #fff;
  border-radius: 4px;
  padding: 0.2em 0.7em;
  font-size: 0.95em;
  font-weight: 500;
`;
const EntityBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  background: var(--background-main);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 0.2em 0.7em;
  font-size: 0.95em;
  font-weight: 500;
`;

// Styled components
const PageContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

const ProjectSelectorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 2rem 0;
  padding: 0;
  position: relative;
`;

const ProjectAccentBar = styled.span`
  display: inline-block;
  width: 4px;
  height: 2.2rem;
  border-radius: 2px;
  background: var(--primary-color);
  margin-right: 0.85rem;
`;

const ProjectLabel = styled.label`
  font-weight: 500;
  font-size: 1rem;
  color: var(--primary-color);
  margin-right: 0.5rem;
  letter-spacing: 0.01em;
`;

const ProjectSelect = styled.select`
  padding: 0.45rem 1.1rem 0.45rem 0.7rem;
  border-radius: 6px;
  border: 1.2px solid var(--border-color);
  background: var(--background-main);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  transition: border-color 0.18s;
  box-shadow: none;
  min-width: 160px;
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1.5px var(--primary-color-light, #b3d4fc);
  }
  &:disabled {
    background: var(--background-secondary);
    color: var(--text-tertiary);
    opacity: 0.7;
  }
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const PageTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
`;

const PageDescription = styled.p`
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

const RefreshIcon = styled.span`
  display: inline-block;
  margin-right: 0.5rem;
`;

const RefreshButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  background-color: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  ${props => props.disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      background-color: transparent;
      color: var(--text-secondary);
      border-color: var(--border-color);
    }
  `}
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--error-color);
`;

const NoDataMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
`;

const ViewLink = styled.a`
  font-size: 0.8rem;
  color: var(--primary-color);
  text-decoration: none;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--primary-color);
  border-radius: 3px;
  
  &:hover {
    background-color: var(--primary-color);
    color: white;
  }
`;

const DetailsList = styled.div`
  display: flex;
  flex-direction: row;
  gap: 2rem;
  background-color: var(--background-main);
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.85rem;
`;

const Detail = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const DetailLabel = styled.span`
  color: var(--text-tertiary);
  width: 80px;
  flex-shrink: 0;
`;

const DetailValue = styled.span`
  color: var(--text-primary);
  word-break: break-word;
`;

const EmptyValue = styled.span`
  font-style: italic;
  color: var(--text-tertiary);
`;

const LoadMoreContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 2rem 0;
`;

const LoadMoreButton = styled.button`
  padding: 0.5rem 1.5rem;
  background-color: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--primary-color);
    color: white;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: transparent;
    color: var(--primary-color);
  }
`;

// Add a small LoadingSpinner component
const LoadingSpinner = styled.div<{ size?: string }>`
  display: inline-block;
  width: ${props => props.size === 'small' ? '16px' : '24px'};
  height: ${props => props.size === 'small' ? '16px' : '24px'};
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Add thumbnail style
const ThumbImg = styled.img`
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  margin-right: 0.5em;
  background: #f3f3f3;
  border: 1px solid #eee;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  transition: background 0.15s;
  &:hover {
    background: #ffeaea;
  }
`;

const ToastContainer = styled.div<{ type: 'success' | 'error' }>`
  position: fixed;
  top: 32px;
  right: 32px;
  z-index: 9999;
  background: ${p => p.type === 'success' ? '#22c55e' : '#ef4444'};
  color: #fff;
  padding: 1rem 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  font-size: 1.1rem;
  font-weight: 500;
  animation: fadeIn 0.3s;
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-16px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default ActivityLogs; 