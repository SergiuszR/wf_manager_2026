import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { webflowAPI } from '../api/apiClient';
import { Project } from './Dashboard';
import { supabase } from '../lib/supabaseClient';
import { useProjectContext } from '../contexts/ProjectContext';

interface WebflowCollection {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
  lastUpdated: string;
  siteName?: string;
  siteId?: string;
  designerUrl?: string;
  createdOn?: string;
  stagedItemCount?: number;
  liveItemCount?: number;
  displayName?: string;
}

interface ModalState {
  isOpen: boolean;
  collection: WebflowCollection | null;
  collectionDetails: any | null;
  error?: string;
}

interface DropdownState {
  isOpen: boolean;
  collectionId: string | null;
}

interface ItemCountsProps {
  $compact?: boolean;
}

interface ItemCountBadgeProps {
  $small?: boolean;
  $live?: boolean;
  $draft?: boolean;
}

interface ItemCountLabelProps {
  $small?: boolean;
}

const CMSEditor: React.FC = () => {
  const { token, user } = useAuth();
  const { projects, selectedProject, setSelectedProject, loading: projectsLoading } = useProjectContext();
  const [collections, setCollections] = useState<WebflowCollection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<WebflowCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    collection: null,
    collectionDetails: null
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WebflowCollection;
    direction: 'ascending' | 'descending';
  }>({ key: 'name', direction: 'ascending' });
  const [loadingAction, setLoadingAction] = useState<{
    type: 'details' | null;
    collectionId: string | null;
  }>({ type: null, collectionId: null });

  // Only fetch collections for the selected project
  useEffect(() => {
    if (!selectedProject || !selectedProject.token) return;
    fetchCollections(selectedProject.token);
    // eslint-disable-next-line
  }, [selectedProject]);

  useEffect(() => {
    // Apply filtering and sorting whenever collections or search term changes
    let result = [...collections];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        collection => 
          collection.name?.toLowerCase().includes(term) || 
          collection.slug?.toLowerCase().includes(term) ||
          collection.siteName?.toLowerCase().includes(term)
      );
    }
    result.sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortConfig.direction === 'ascending') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (sortConfig.direction === 'ascending') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
      return 0;
    });
    setFilteredCollections(result);
  }, [collections, searchTerm, sortConfig]);

  useEffect(() => {
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const fetchCollections = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await webflowAPI.getCollections(token);
      
      // Format collection data to ensure consistent properties
      const formattedCollections: WebflowCollection[] = (response.data.collections || []).map((collection: any) => ({
        id: collection.id || collection._id,
        name: collection.displayName || collection.name || 'Unnamed Collection',
        slug: collection.slug || '',
        itemCount: collection.itemCount || 0,
        stagedItemCount: collection.stagedItemCount || collection.itemCount || 0,
        liveItemCount: collection.liveItemCount || 0,
        lastUpdated: collection.lastUpdated || '',
        siteName: collection.siteName || '',
        siteId: collection.siteId || '',
        designerUrl: collection.designerUrl || '',
        createdOn: collection.createdOn || '',
        displayName: collection.displayName || collection.name || 'Unnamed Collection'
      }));

      setCollections(formattedCollections);

      // After setting, fetch details for each collection to update counts
      formattedCollections.forEach((col: WebflowCollection, idx: number) => {
        setTimeout(() => {
          webflowAPI.getCollectionDetails(col.id, token).then(detailsRes => {
            const details = detailsRes.data?.collection;
            if (details && (details.stagedItemCount !== undefined || details.liveItemCount !== undefined)) {
              setCollections(prev => prev.map(c =>
                c.id === col.id
                  ? {
                      ...c,
                      stagedItemCount: details.stagedItemCount !== undefined ? details.stagedItemCount : c.stagedItemCount,
                      liveItemCount: details.liveItemCount !== undefined ? details.liveItemCount : c.liveItemCount,
                      itemCount: details.itemCount !== undefined ? details.itemCount : c.itemCount
                    }
                  : c
              ));
            }
          }).catch(() => {/* ignore errors for now */});
        }, idx * 150); // stagger requests to avoid rate limits
      });
    } catch (err: any) {
      console.error('Error fetching collections:', err);
      setError(err.response?.data?.message || 'Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSort = (key: keyof WebflowCollection) => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        // Toggle direction if clicking the same column
        return {
          key,
          direction: prevConfig.direction === 'ascending' ? 'descending' : 'ascending',
        };
      }
      // Default to ascending for new column sort
      return { key, direction: 'ascending' };
    });
  };

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Check if the click is outside the dropdown
    if (!target.closest('.dropdown-menu') && !target.closest('.menu-trigger')) {
      setActiveDropdown(null);
      document.removeEventListener('click', handleClickOutside);
    }
  };

  const handleMenuClick = (event: React.MouseEvent, collectionId: string) => {
    event.stopPropagation();
    
    // Toggle dropdown for this collection
    if (activeDropdown === collectionId) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(collectionId);
    }
    
    // Add click outside handler
    document.addEventListener('click', handleClickOutside);
  };

  // Render a table row for each collection
  const renderTableRow = (collection: WebflowCollection) => {
    const stagedCount = collection.stagedItemCount !== undefined ? 
      collection.stagedItemCount : 
      collection.itemCount !== undefined ? collection.itemCount : 0;
    const liveCount = collection.liveItemCount !== undefined ? collection.liveItemCount : 0;
    const draftCount = Math.max(0, stagedCount - liveCount);
    
    return (
      <TableRow key={collection.id}>
        <TableCell>{collection.name}</TableCell>
        <TableCell>{collection.slug}</TableCell>
        <TableCell>
          <ItemCountsContainer $compact>
            <ItemCountBadge $small>
              <ItemCountLabel $small>All:</ItemCountLabel>
              {stagedCount}
            </ItemCountBadge>
            <ItemCountBadge $small $live>
              <ItemCountLabel $small>Live:</ItemCountLabel>
              {liveCount}
            </ItemCountBadge>
            {stagedCount > 0 && liveCount >= 0 && (
              <ItemCountBadge $small $draft>
                <ItemCountLabel $small>Draft:</ItemCountLabel>
                {draftCount}
              </ItemCountBadge>
            )}
          </ItemCountsContainer>
        </TableCell>
        <TableCell>{formatDate(collection.lastUpdated)}</TableCell>
        <TableCell>{collection.siteName || 'N/A'}</TableCell>
        <TableCell>
          <ActionButtons>
            {collection.designerUrl && (
              <ActionButton 
                onClick={() => window.open(collection.designerUrl, '_blank')}
                title="Open in Webflow Designer"
              >
                <span role="img" aria-label="Designer">🎨</span>
              </ActionButton>
            )}
            <div style={{ position: 'relative' }}>
              <ActionButton 
                className="menu-trigger"
                onClick={(e) => handleMenuClick(e, collection.id)}
                title="More actions"
              >
                <span>⋮</span>
              </ActionButton>
              {renderDropdown(collection.id)}
            </div>
          </ActionButtons>
        </TableCell>
      </TableRow>
    );
  };

  // Render the dropdown menu for a collection
  const renderDropdown = (collectionId: string | null) => {
    if (!collectionId || activeDropdown !== collectionId) return null;
    
    return (
      <DropdownContainer 
        className="dropdown-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation();
            // Add edit functionality here in the future
          }} 
          className="dropdown-item"
        >
          <span role="img" aria-label="Edit">✏️</span> Edit Schema
        </div>
      </DropdownContainer>
    );
  };

  if (!selectedProject) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>Please select a project to continue.</div>;
  }

  return (
    <PageContainer>
      {/* Always show the project selector at the top */}
      <ProjectSelectorContainer>
        <ProjectAccentBar />
        <ProjectLabel htmlFor="project-select">Project</ProjectLabel>
        <ProjectSelect
          id="project-select"
          value={selectedProject?.id || ''}
          onChange={e => {
            const proj = projects.find((p: Project) => String(p.id) === e.target.value);
            setSelectedProject(proj || null);
          }}
          disabled={projects.length <= 1}
        >
          {projects.map((p: Project) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </ProjectSelect>
      </ProjectSelectorContainer>
      {!user ? null :
        projects.length === 0 ? (
          <div>Please add a project to access this section.</div>
        ) : !selectedProject ? (
          <>
            <div>Please select a project to continue.</div>
          </>
        ) : (
          <>
            <PageHeader>
              <div>
                <PageTitle>CMS Editor</PageTitle>
                <PageDescription>
                  Edit and manage CMS collections from your connected Webflow sites
                </PageDescription>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <SearchContainer>
                  <SearchIcon>🔍</SearchIcon>
                  <SearchInput
                    type="text"
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <ClearButton onClick={() => setSearchTerm('')}>×</ClearButton>
                  )}
                </SearchContainer>
                <RefreshButton onClick={() => selectedProject && selectedProject.token && fetchCollections(selectedProject.token)} disabled={loading}>
                  {loading ? <LoadingSpinner size="small" /> : <RefreshIcon>↻</RefreshIcon>}
                  Refresh
                </RefreshButton>
              </div>
            </PageHeader>

            {loading ? (
              <LoadingMessage>Loading collections...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : filteredCollections.length === 0 ? (
              searchTerm ? (
                <NoDataMessage>No collections found matching "{searchTerm}".</NoDataMessage>
              ) : (
                <NoDataMessage>No collections found in your Webflow projects.</NoDataMessage>
              )
            ) : (
              <>
                <CollectionCount>
                  {filteredCollections.length === collections.length
                    ? `${collections.length} collections found`
                    : `${filteredCollections.length} of ${collections.length} collections found`}
                </CollectionCount>
                <CollectionsTable>
                  <thead>
                    <TableRow>
                      <TableHeader onClick={() => handleSort('name')}>
                        Name {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('slug')}>
                        Slug {sortConfig.key === 'slug' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('itemCount')}>
                        Items {sortConfig.key === 'itemCount' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('lastUpdated')}>
                        Last Updated {sortConfig.key === 'lastUpdated' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('siteName')}>
                        Site {sortConfig.key === 'siteName' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </thead>
                  <tbody>
                    {(filteredCollections as WebflowCollection[]).map(renderTableRow)}
                  </tbody>
                </CollectionsTable>
              </>
            )}
          </>
        )
      }
    </PageContainer>
  );
};

// Styled components
const PageContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

const ProjectSelectorContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  margin-bottom: 2rem;
`;

const ProjectAccentBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 5px;
  background-color: var(--primary-color);
  border-top-left-radius: var(--border-radius);
  border-bottom-left-radius: var(--border-radius);
`;

const ProjectLabel = styled.label`
  font-weight: 600;
  margin-right: 1rem;
  color: var(--text-primary);
`;

const ProjectSelect = styled.select`
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-main);
  color: var(--text-primary);
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const PageHeader = styled.div`
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const PageTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
`;

const PageDescription = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
`;

const SearchContainer = styled.div`
  position: relative;
  width: 300px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-main);
  color: var(--text-primary);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  
  &:hover {
    color: var(--error-color);
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--primary-hover);
  }
  
  &:disabled {
    background-color: var(--disabled-color);
    cursor: not-allowed;
  }
`;

const RefreshIcon = styled.span`
  font-size: 1.25rem;
`;

const LoadingSpinner = styled.div<{ size?: 'small' | 'medium' | 'large' }>`
  width: ${props => props.size === 'small' ? '16px' : props.size === 'large' ? '32px' : '24px'};
  height: ${props => props.size === 'small' ? '16px' : props.size === 'large' ? '32px' : '24px'};
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingMessage = styled.div`
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
`;

const NoDataMessage = styled.div`
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  background-color: rgba(229, 62, 62, 0.1);
  border-radius: var(--border-radius);
  padding: 1rem;
  margin-bottom: 1.5rem;
`;

const CollectionCount = styled.div`
  margin-bottom: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

const CollectionsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  overflow: hidden;
`;

const TableRow = styled.tr`
  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  background-color: var(--secondary-color);
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--secondary-hover);
  }
`;

const TableCell = styled.td`
  padding: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  font-size: 1.25rem;
  color: var(--text-secondary);
  transition: color 0.2s;
  
  &:hover {
    color: var(--primary-color);
  }
`;

const DropdownContainer = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  width: 180px;
  background-color: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  overflow: hidden;
  
  .dropdown-item {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: var(--hover-color);
    }
    
    &.loading {
      cursor: wait;
    }
  }
`;

const ItemCountsContainer = styled.div<ItemCountsProps>`
  display: flex;
  gap: ${props => props.$compact ? '0.25rem' : '0.5rem'};
`;

const ItemCountBadge = styled.div<ItemCountBadgeProps>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: ${props => props.$small ? '0.1rem 0.3rem' : '0.25rem 0.5rem'};
  border-radius: 4px;
  font-size: ${props => props.$small ? '0.7rem' : '0.8rem'};
  background-color: ${props => 
    props.$live ? 'rgba(72, 187, 120, 0.1)' :
    props.$draft ? 'rgba(237, 137, 54, 0.1)' :
    'rgba(66, 153, 225, 0.1)'
  };
  color: ${props => 
    props.$live ? 'var(--success-color)' :
    props.$draft ? 'var(--warning-color)' :
    'var(--info-color)'
  };
`;

const ItemCountLabel = styled.span<ItemCountLabelProps>`
  font-weight: 600;
  font-size: ${props => props.$small ? '0.7rem' : '0.8rem'};
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.primary ? `
    background-color: var(--primary-color);
    color: white;
    border: none;
    
    &:hover {
      background-color: var(--primary-hover);
    }
  ` : `
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    
    &:hover {
      background-color: var(--hover-color);
    }
  `}
`;

export default CMSEditor; 