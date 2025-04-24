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

const Collections: React.FC = () => {
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

  const fetchCollectionDetails = async (collection: WebflowCollection): Promise<void> => {
    setLoadingDetails(true);
    setError('');
    try {
      if (!selectedProject?.token) {
        throw new Error('No project token available');
      }
      console.log(`[DEBUG] Fetching collection details for ID: ${collection.id}`);
      console.log(`[DEBUG] Collection object:`, collection);
      const response = await webflowAPI.getCollectionDetails(collection.id, selectedProject.token);
      console.log('[DEBUG] Collection details response:', response.data);
      if (response.data?.collection?.fields) {
        console.log('[DEBUG] Fields received:', response.data.collection.fields.length);
        console.log('[DEBUG] First few fields:', response.data.collection.fields.slice(0, 3));
      } else {
        console.log('[DEBUG] No fields received in response');
      }
      setModal({
        isOpen: true,
        collection,
        collectionDetails: response.data.collection,
        error: undefined
      });
    } catch (err: any) {
      setModal({
        isOpen: true,
        collection,
        collectionDetails: null,
        error: err.response?.data?.message || err.message || 'Failed to fetch collection details'
      });
    } finally {
      setLoadingDetails(false);
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

  // Add a click outside handler
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Check if the click is outside the dropdown
    if (!target.closest('.dropdown-menu') && !target.closest('.menu-trigger')) {
      setActiveDropdown(null);
      document.removeEventListener('click', handleClickOutside);
    }
  };

  const handleMenuOptionClick = (option: string, collectionId: string) => {
    // Find the collection from the ID
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    // Close dropdown
    setActiveDropdown(null);
    
    // Set the loading state
    setLoadingAction({
      type: 'details',
      collectionId
    });
    
    // Handle the selected option
    switch (option) {
      case 'details':
        setModal({
          isOpen: true,
          collection,
          collectionDetails: null
        });
        fetchCollectionDetails(collection)
          .finally(() => {
            setLoadingAction({ type: null, collectionId: null });
          });
        break;
      default:
        setLoadingAction({ type: null, collectionId: null });
        break;
    }
  };

  const closeModal = () => {
    setModal({ isOpen: false, collection: null, collectionDetails: null });
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
  
  // Update renderDropdown to show loading indicators
  const renderDropdown = (collectionId: string | null) => {
    if (!collectionId || activeDropdown !== collectionId) return null;
    
    const isLoading = loadingAction.collectionId === collectionId;
    
    return (
      <DropdownContainer 
        className="dropdown-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) handleMenuOptionClick('details', collectionId);
          }} 
          className={`dropdown-item ${isLoading && loadingAction.type === 'details' ? 'loading' : ''}`}
          style={{ opacity: isLoading && loadingAction.type !== 'details' ? 0.5 : 1 }}
        >
          {isLoading && loadingAction.type === 'details' ? (
            <LoadingSpinner size="small" />
          ) : (
            <span role="img" aria-label="Info">ℹ️</span>
          )} View Details
        </div>
      </DropdownContainer>
    );
  };
  
  // Render the collection details modal
  const renderCollectionDetailsModal = () => {
    if (!modal.isOpen) return null;
    
    const { collection, collectionDetails, error } = modal;
    
    // Get the best available name for the collection
    const collectionName = collectionDetails?.displayName || 
                           collectionDetails?.name || 
                           collection?.displayName || 
                           collection?.name || 
                           'Collection Details';
    
    return (
      <ModalOverlay onClick={closeModal}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>{collectionName}</ModalTitle>
            <CloseButton onClick={closeModal}>×</CloseButton>
          </ModalHeader>
          
          <ModalBody>
            {loadingDetails ? (
              <LoadingMessage>Loading collection details...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : !collectionDetails ? (
              <ErrorMessage>Failed to load collection details</ErrorMessage>
            ) : (
              <DetailsGrid>
                <DetailItem>
                  <DetailLabel>Collection ID</DetailLabel>
                  <DetailValue>{collectionDetails.id}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Name</DetailLabel>
                  <DetailValue>{collectionDetails.name}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Slug</DetailLabel>
                  <DetailValue>{collectionDetails.slug}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Last Updated</DetailLabel>
                  <DetailValue>{formatDate(collectionDetails.lastUpdated)}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Site</DetailLabel>
                  <DetailValue>{collection?.siteName || 'N/A'}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Items</DetailLabel>
                  <DetailValue>
                    <ItemCountsContainer>
                      <ItemCountBadge>
                        <ItemCountLabel>All Items:</ItemCountLabel>
                        {collectionDetails.stagedItemCount !== undefined ? 
                          collectionDetails.stagedItemCount : 
                          collectionDetails.itemCount !== undefined ? 
                            collectionDetails.itemCount : 0}
                      </ItemCountBadge>
                      <ItemCountBadge $live>
                        <ItemCountLabel>Live:</ItemCountLabel>
                        {collectionDetails.liveItemCount !== undefined ? 
                          collectionDetails.liveItemCount : 0}
                      </ItemCountBadge>
                      {collectionDetails.stagedItemCount !== undefined && 
                       collectionDetails.liveItemCount !== undefined && (
                        <ItemCountBadge $draft>
                          <ItemCountLabel>Draft:</ItemCountLabel>
                          {Math.max(0, collectionDetails.stagedItemCount - collectionDetails.liveItemCount)}
                        </ItemCountBadge>
                      )}
                    </ItemCountsContainer>
                  </DetailValue>
                </DetailItem>
                
                {collectionDetails.createdOn && (
                  <DetailItem>
                    <DetailLabel>Created On</DetailLabel>
                    <DetailValue>{formatDate(collectionDetails.createdOn)}</DetailValue>
                  </DetailItem>
                )}
                
                {collectionDetails.fields && collectionDetails.fields.length > 0 && (
                  <DetailItem span={2}>
                    <DetailLabel>Fields ({collectionDetails.fields.length})</DetailLabel>
                    <FieldsList>
                      {collectionDetails.fields.map((field: any) => (
                        <FieldItem key={field.id || field.slug}>
                          <FieldName>
                            {field.displayName || field.name}
                            {field.isRequired && <RequiredBadge>Required</RequiredBadge>}
                          </FieldName>
                          <FieldType>
                            {field.type}
                            {field.slug && <FieldSlug>({field.slug})</FieldSlug>}
                          </FieldType>
                        </FieldItem>
                      ))}
                    </FieldsList>
                  </DetailItem>
                )}
                
                {(!collectionDetails.fields || collectionDetails.fields.length === 0) && (
                  <DetailItem span={2}>
                    <DetailLabel>Fields</DetailLabel>
                    <DetailValue style={{ fontStyle: 'italic', color: '#666' }}>
                      No fields available for this collection
                    </DetailValue>
                  </DetailItem>
                )}
                
                {collection?.designerUrl && (
                  <DetailItem>
                    <DetailLabel>Designer URL</DetailLabel>
                    <DetailValue>
                      <DetailLink href={collection.designerUrl} target="_blank" rel="noopener noreferrer">
                        Open in Designer <span>↗</span>
                      </DetailLink>
                    </DetailValue>
                  </DetailItem>
                )}
              </DetailsGrid>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={closeModal}>Close</Button>
            {!error && !loadingDetails && collectionDetails && collection?.designerUrl && (
              <Button 
                primary
                onClick={() => window.open(collection.designerUrl, '_blank')}
              >
                Open in Designer
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  };

  if (!selectedProject) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>Please select a project to continue.</div>;
  }

  // Move early returns to conditional rendering in the return statement
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
                <PageTitle>Webflow Collections</PageTitle>
                <PageDescription>
                  Browse all CMS collections from your connected Webflow sites
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
      {renderCollectionDetailsModal()}
    </PageContainer>
  );
};

// Styled components
const PageContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
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
  color: var(--text-tertiary);
  border-radius: var(--border-radius);
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--text-primary);
  }
`;

const DropdownContainer = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 5px;
  background-color: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 10px var(--shadow-color, rgba(0, 0, 0, 0.1));
  z-index: 1000;
  min-width: 180px;
  overflow: hidden;

  .dropdown-item {
    padding: 10px 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-primary);
    background: none;
    &:hover {
      background-color: var(--hover-color);
    }
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const ModalContent = styled.div`
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ModalHeader = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--text-tertiary);
  cursor: pointer;
  
  &:hover {
    color: var(--text-primary);
  }
`;

const ModalBody = styled.div`
  padding: 1.25rem;
  overflow-y: auto;
`;

const ModalFooter = styled.div`
  padding: 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 0.5rem 1rem;
  background-color: ${props => props.primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.primary ? 'white' : 'var(--text-secondary)'};
  border: ${props => props.primary ? 'none' : '1px solid var(--border-color)'};
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${props => props.primary ? 'var(--primary-hover)' : 'var(--hover-color)'};
    color: ${props => props.primary ? 'white' : 'var(--primary-color)'};
    border-color: ${props => props.primary ? 'none' : 'var(--primary-color)'};
  }
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
`;

const DetailItem = styled.div<{ span?: number }>`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  ${props => props.span && `
    grid-column: span ${props.span};
  `}
`;

const DetailLabel = styled.span`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 500;
`;

const DetailValue = styled.span`
  font-size: 0.875rem;
  color: var(--text-primary);
  word-break: break-word;
  overflow-wrap: break-word;
`;

const DetailLink = styled.a`
  color: var(--primary-color);
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
  
  span {
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }
`;

// Styled components for field items
const FieldsList = styled.div`
  margin-top: 0.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
`;

const FieldItem = styled.div`
  padding: 0.75rem;
  background-color: var(--background-light);
  border-radius: 0.25rem;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
`;

const FieldName = styled.div`
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FieldType = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const RequiredBadge = styled.span`
  background-color: var(--error-color);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const FieldSlug = styled.span`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background-color: var(--secondary-color);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
`;

const LoadingSpinner = styled.div<{ size?: 'small' | 'medium' | 'large' }>`
  display: inline-block;
  width: ${props => props.size === 'small' ? '16px' : props.size === 'large' ? '32px' : '24px'};
  height: ${props => props.size === 'small' ? '16px' : props.size === 'large' ? '32px' : '24px'};
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color, #3e98e5);
  animation: spin 0.8s linear infinite;
  margin-right: ${props => props.size === 'small' ? '6px' : '8px'};
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Count badge styled components
const ItemCountsContainer = styled.div<ItemCountsProps>`
  display: flex;
  gap: ${props => props.$compact ? '4px' : '8px'};
  flex-wrap: wrap;
`;

const ItemCountBadge = styled.div<ItemCountBadgeProps>`
  display: inline-flex;
  align-items: center;
  font-size: ${props => props.$small ? '0.7rem' : '0.8rem'};
  padding: ${props => props.$small ? '2px 4px' : '3px 6px'};
  border-radius: 4px;
  font-weight: 500;
  background-color: ${props => {
    if (props.$draft) return '#fff3e0';
    if (props.$live) return '#e3f7ea';
    return '#ebf3fd';
  }};
  color: ${props => {
    if (props.$draft) return '#d97706';
    if (props.$live) return '#166534';
    return '#1a64b3';
  }};
`;

const ItemCountLabel = styled.span<ItemCountLabelProps>`
  font-weight: ${props => props.$small ? '400' : '500'};
  margin-right: 4px;
  opacity: 0.9;
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

// Add search components
const SearchContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 300px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 35px 8px 30px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  color: var(--text-primary);
  background-color: var(--background-light);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }
  
  &::placeholder {
    color: var(--text-tertiary);
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: 1.2rem;
  
  &:hover {
    color: var(--text-primary);
  }
`;

// Sleek, modern, unified Project Selector
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

export default Collections;