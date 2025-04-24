import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { saveAs } from 'file-saver';
import { format, addMinutes, addHours, addDays } from 'date-fns';
import { webflowAPI } from '../api/apiClient';
import { Project } from './Dashboard';
import { supabase } from '../lib/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useProjectContext } from '../contexts/ProjectContext';

interface WebflowPage {
  id: string;
  title: string;
  slug: string;
  lastUpdated: string;
  siteName: string;
  siteId: string;
  collectionId?: string;
  isMembersOnly?: boolean;
  type?: string;  // Can be 'page', 'collection', etc.
  previewUrl?: string; // URL for viewing the page in Webflow designer
  url?: string; // Published URL for the page
}

interface DropdownState {
  isOpen: boolean;
  pageId: string | null;
}

interface ModalState {
  isOpen: boolean;
  page: WebflowPage | null;
  pageDetails: any | null;
  error?: string;
}

interface PublishState {
  isOpen: boolean;
  isScheduling: boolean;
  scheduledTime: string;
  isPublishing: boolean;
  isSuccess: boolean;
  error: string | null;
}

interface DOMModalState {
  isOpen: boolean;
  page: WebflowPage | null;
  domContent: any | null;
  error?: string;
}

// Add a type for CMS item pages
interface CmsItemPage {
  id: string;
  name: string;
  slug: string;
  url: string;
  parentTemplateId: string;
  siteName: string;
  siteId: string;
  collectionId: string;
  isDraft?: boolean;
}

// Extend the User type locally to include webflowToken
interface UserWithWebflowToken extends SupabaseUser {
  webflowToken?: string;
  tokenName?: string;
}

const Pages: React.FC = () => {
  // Move all useRef hooks to the top before any useState/useEffect
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cmsItemsRefMap = useRef<Map<string, CmsItemPage[]>>(new Map());

  const { token, user: rawUser } = useAuth();
  const user = rawUser as UserWithWebflowToken | null;
  const { projects, selectedProject, setSelectedProject, loading: projectsLoading } = useProjectContext();
  const [pages, setPages] = useState<WebflowPage[]>([]);
  const [filteredPages, setFilteredPages] = useState<WebflowPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCmsPages, setShowCmsPages] = useState(true);
  const [dropdown, setDropdown] = useState<DropdownState>({ isOpen: false, pageId: null });
  const [modal, setModal] = useState<ModalState>({ isOpen: false, page: null, pageDetails: null });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WebflowPage;
    direction: 'ascending' | 'descending';
  }>({ key: 'title', direction: 'ascending' });
  const [publishState, setPublishState] = useState<PublishState>({
    isOpen: false,
    isScheduling: false,
    scheduledTime: '',
    isPublishing: false,
    isSuccess: false,
    error: null
  });
  const [domModal, setDomModal] = useState<DOMModalState>({
    isOpen: false,
    page: null,
    domContent: null
  });
  const [loadingDom, setLoadingDom] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<{
    type: 'details' | 'dom' | 'publish' | null;
    pageId: string | null;
  }>({ type: null, pageId: null });
  const [cmsItemsByCollection, setCmsItemsByCollection] = useState<Record<string, CmsItemPage[]>>({});
  const [loadingCmsItems, setLoadingCmsItems] = useState<Record<string, boolean>>({});

  // Only fetch pages for the selected project
  useEffect(() => {
    if (!selectedProject || !selectedProject.token) return;
    fetchPages();
    // eslint-disable-next-line
  }, [selectedProject]);

  // Filtering and sorting hooks should always run, but will be no-op if pages is empty
  useEffect(() => {
    let result = [...pages];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        page => 
          page.title?.toLowerCase().includes(term) || 
          page.slug?.toLowerCase().includes(term) ||
          page.siteName?.toLowerCase().includes(term)
      );
    }
    if (!showCmsPages) {
      result = result.filter(page => !isCollectionPage(page));
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
      return 0;
    });
    setFilteredPages(result);
  }, [pages, searchTerm, showCmsPages, sortConfig]);

  // Fetch CMS items for visible CMS templates when filteredPages changes
  useEffect(() => {
    const visibleTemplates = filteredPages.filter(
      p => isCollectionPage(p) && p.collectionId
    );
    visibleTemplates.forEach(template => {
      if (!cmsItemsByCollection[template.collectionId!]) {
        fetchCmsItemsForCollection(template);
      }
    });
    // eslint-disable-next-line
  }, [filteredPages]);

  // Add a click outside handler
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    // Check if the click is outside the dropdown
    if (!target.closest('.dropdown-menu') && !target.closest('.menu-trigger')) {
      setActiveDropdown(null);
      document.removeEventListener('click', handleClickOutside);
    }
  };

  // Clean up event listener when component unmounts
  useEffect(() => {
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Define closeModal before usage
  const closeModal = () => {
    setModal({ isOpen: false, page: null, pageDetails: null });
  };

  // Define handleMenuOptionClick before usage
  const handleMenuOptionClick = (option: string, pageId: string) => {
    // Find the page from the ID
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    // Close dropdown
    setActiveDropdown(null);
    // Set the loading state
    setLoadingAction({
      type: option as 'details' | 'dom' | 'publish',
      pageId
    });
    switch (option) {
      case 'details':
        setModal({
          isOpen: true,
          page,
          pageDetails: null
        });
        fetchPageDetails(page)
          .finally(() => {
            setLoadingAction({ type: null, pageId: null });
          });
        break;
      case 'dom':
        fetchPageDom(pageId)
          .finally(() => {
            setLoadingAction({ type: null, pageId: null });
          });
        break;
      case 'publish':
        // Set the modal data and then open the publish modal
        setModal({
          isOpen: false,
          page,
          pageDetails: null
        });
        openPublishModal();
        setLoadingAction({ type: null, pageId: null });
        break;
    }
  };

  // Project selector UI
  const renderProjectSelector = () => (
    projects.length > 1 && (
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="project-select">Select Project: </label>
        <select
          id="project-select"
          value={selectedProject?.id || ''}
          onChange={e => {
            const proj = projects.find(p => p.id === e.target.value);
            setSelectedProject(proj || null);
          }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    )
  );

  if (!user) return null;
  if (projects.length === 0) {
    return <div>Please add a project to access this section.</div>;
  }
  if (!selectedProject) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>Please select a project to continue.</div>;
  }

  const fetchPages = async () => {
    if (!selectedProject?.token) return;
    setLoading(true);
    setError('');
    try {
      const response = await webflowAPI.getPages(selectedProject.token);
      const formattedPages = (response.data.pages || []).map((page: any) => ({
        id: page.id || page._id,
        title: page.title || page.name,
        slug: page.slug || '',
        lastUpdated: page.lastUpdated || '',
        siteName: page.siteName || '',
        siteId: page.siteId || '',
        collectionId: page.collectionId || null,
        isMembersOnly: page.isMembersOnly || false,
        type: page.type || (page.collectionId ? 'collection' : 'page'),
        previewUrl: page.previewUrl || '',
        url: page.url || ''
      }));
      setPages(formattedPages);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch pages');
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

  const isCollectionPage = (page: WebflowPage) => {
    return !!page.collectionId || page.type === 'collection' || page.type === 'collection-template';
  };

  const handleSort = (key: keyof WebflowPage) => {
    setSortConfig({
      key,
      direction: 
        sortConfig.key === key && sortConfig.direction === 'ascending' 
          ? 'descending' 
          : 'ascending'
    });
  };

  const getPageUrl = (page: WebflowPage) => {
    // Prefer the published URL if available (direct site access)
    if (page.url) return { url: page.url, isPublished: true };
    
    // Fall back to the editor URL if no published URL
    if (page.previewUrl) return { url: page.previewUrl, isPublished: false };
    
    // Fallback: we don't have a URL for this page
    return { url: null, isPublished: false };
  };

  // Helper to fetch CMS items for a collection (template page)
  const fetchCmsItemsForCollection = async (templatePage: WebflowPage) => {
    if (!templatePage.collectionId || !selectedProject?.token) return;
    setLoadingCmsItems(prev => ({ ...prev, [templatePage.collectionId!]: true }));
    try {
      const res = await webflowAPI.getCollectionItems(templatePage.collectionId, selectedProject.token);
      // Construct URLs for each item using the template's url as base
      // name and slug are from fieldData per Webflow API v2
      const baseUrl = templatePage.url?.replace(/\/$/, '') || '';
      const items: CmsItemPage[] = (res.data.items || []).map((item: any) => ({
        id: item.id,
        name: item.name, // from fieldData.name
        slug: item.slug, // from fieldData.slug
        url: baseUrl + '/' + item.slug,
        parentTemplateId: templatePage.id,
        siteName: templatePage.siteName,
        siteId: templatePage.siteId,
        collectionId: templatePage.collectionId!,
        isDraft: item.isDraft === true
      }));
      setCmsItemsByCollection(prev => ({ ...prev, [templatePage.collectionId!]: items }));
    } catch (e) {
      setCmsItemsByCollection(prev => ({ ...prev, [templatePage.collectionId!]: [] }));
    } finally {
      setLoadingCmsItems(prev => ({ ...prev, [templatePage.collectionId!]: false }));
    }
  };

  // Helper to render a CMS item row
  const renderCmsItemRow = (item: CmsItemPage) => {
    return (
      <StyledTableRow key={item.id} $isCmsPage={true} className="cms-item-row">
        <TableCell className="cms-item-cell">
          <CmsItemArrow>↳</CmsItemArrow> {item.name}
          {item.isDraft && <DraftBadge>Draft</DraftBadge>}
          <LinkIcon title="View published CMS item">🌐</LinkIcon>
        </TableCell>
        <TableCell>{item.slug}</TableCell>
        <TableCell>-</TableCell>
        <TableCell>
          <PageTypeTag isCmsPage={true}>CMS Item</PageTypeTag>
        </TableCell>
        <TableCell>
          <ActionButtons>
            <ActionButton 
              onClick={e => {
                e.stopPropagation();
                window.open(item.url, '_blank');
              }}
              title="View published CMS item"
            >
              <span role="img" aria-label="View">👁️</span>
            </ActionButton>
          </ActionButtons>
        </TableCell>
      </StyledTableRow>
    );
  };

  // Modified renderTableRow to include CMS items as children
  const renderTableRowWithCmsItems = (page: WebflowPage) => {
    const row = renderTableRow(page);
    if (isCollectionPage(page) && page.collectionId) {
      const items = cmsItemsByCollection[page.collectionId];
      const loading = loadingCmsItems[page.collectionId];
      return [
        row,
        loading ? (
          <StyledTableRow key={page.id + '-loading'} $isCmsPage={true}>
            <TableCell colSpan={5} style={{ paddingLeft: 40, color: '#888' }}>
              <LoadingSpinner size="small" /> Loading CMS items...
            </TableCell>
          </StyledTableRow>
        ) : items && items.length > 0 ? (
          items.map(renderCmsItemRow)
        ) : null
      ];
    }
    return row;
  };

  // For export: flatten the tree to include CMS items
  const getExportRows = () => {
    const rows: any[] = [];
    filteredPages.forEach(page => {
      rows.push(page);
      if (isCollectionPage(page) && page.collectionId) {
        const items = cmsItemsByCollection[page.collectionId];
        if (items && items.length > 0) {
          items.forEach(item => {
            rows.push({
              ...item,
              title: item.name,
              type: 'cms-item',
              lastUpdated: '',
              isCmsItem: true
            });
          });
        }
      }
    });
    return rows;
  };

  // Update exportToCSV to use getExportRows
  const exportToCSV = () => {
    const exportRows = getExportRows();
    if (exportRows.length === 0) return;
    const headers = ['Title', 'Slug', 'Type', 'Last Updated', 'URL', 'Core Collection', 'Is Draft?'];
    const csvData = exportRows.map(page => [
      `"${(page.title || page.name || '').replace(/"/g, '""')}"`,
      `"${page.slug || ''}"`,
      `"${page.isCmsItem ? 'CMS Item' : isCollectionPage(page) ? 'CMS Template' : 'Static Page'}"`,
      `"${page.lastUpdated || ''}"`,
      `"${page.url || ''}"`,
      // Core Collection: for CMS items, use parentTemplateId to find the collection name
      page.isCmsItem && page.parentTemplateId
        ? (() => {
            const parent = pages.find(p => p.id === page.parentTemplateId);
            return parent ? `"${parent.title || ''}"` : '';
          })()
        : '',
      // Is Draft?
      page.isCmsItem ? (page.isDraft ? 'true' : 'false') : ''
    ]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `webflow-pages-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const fetchPageDetails = async (page: WebflowPage): Promise<void> => {
    setLoadingDetails(true);
    setError('');
    try {
      if (!selectedProject?.token) {
        throw new Error('No project token available');
      }
      const response = await webflowAPI.getPageDetails(page.id, page.siteId, selectedProject.token);
      setModal({
        isOpen: true,
        page,
        pageDetails: response.data
      });
    } catch (err: any) {
      let errorMessage = 'Failed to load page details';
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Authentication error: Your token may have expired';
        } else if (err.response.status === 404) {
          errorMessage = 'Page not found: The API could not find this page';
        } else if (err.response.data && err.response.data.message) {
          errorMessage = `API Error: ${err.response.data.message}`;
        }
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = err.message || 'An unknown error occurred';
      }
      setError(errorMessage);
      setModal({
        isOpen: true,
        page,
        pageDetails: null,
        error: errorMessage
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchPageDom = async (pageId: string): Promise<void> => {
    setLoadingDom(true);
    setError('');
    try {
      if (!selectedProject?.token) {
        throw new Error('No project token available');
      }
      const response = await webflowAPI.getPageDom(pageId, selectedProject.token);
      const page = pages.find(p => p.id === pageId) || null;
      setDomModal({
        isOpen: true,
        page,
        domContent: response.data.dom
      });
    } catch (err: any) {
      let errorMessage = 'Failed to load page DOM';
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Authentication error: Your token may have expired';
        } else if (err.response.status === 404) {
          errorMessage = 'Page not found: The API could not find this page';
        } else if (err.response.data && err.response.data.message) {
          errorMessage = `API Error: ${err.response.data.message}`;
        }
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = err.message || 'An unknown error occurred';
      }
      setError(errorMessage);
      setDomModal({
        isOpen: true,
        page: null,
        domContent: null,
        error: errorMessage
      });
    } finally {
      setLoadingDom(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent, pageId: string) => {
    event.stopPropagation();
    
    // Toggle dropdown for this page
    if (activeDropdown === pageId) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(pageId);
    }
    
    // Close the old dropdown state if it's open
    if (dropdown.isOpen) {
      setDropdown({ isOpen: false, pageId: null });
    }
    
    // Add click outside handler
    document.addEventListener('click', handleClickOutside);
  };

  // Handle opening the publish modal
  const openPublishModal = () => {
    setPublishState({
      ...publishState,
      isOpen: true
    });
  };

  // Handle closing the publish modal
  const closePublishModal = () => {
    setPublishState({
      ...publishState,
      isOpen: false
    });
  };

  // Toggle scheduling mode
  const toggleScheduling = () => {
    setPublishState({
      ...publishState,
      isScheduling: !publishState.isScheduling,
      scheduledTime: !publishState.isScheduling 
        ? format(addMinutes(new Date(), 15), "yyyy-MM-dd'T'HH:mm") 
        : ''
    });
  };

  // Handle scheduled time change
  const handleScheduledTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPublishState({
      ...publishState,
      scheduledTime: e.target.value
    });
  };

  // Set quick time options
  const setQuickTime = (minutes: number) => {
    const newTime = addMinutes(new Date(), minutes);
    setPublishState({
      ...publishState,
      scheduledTime: format(newTime, "yyyy-MM-dd'T'HH:mm")
    });
  };

  // Handle publishing the page
  const handlePublish = async () => {
    if (!modal.page || !modal.page.siteId) {
      setPublishState({
        ...publishState,
        error: 'Missing page or site information'
      });
      return;
    }

    if (!selectedProject?.token) {
      setPublishState({
        ...publishState,
        error: 'No project token available'
      });
      return;
    }

    setPublishState({
      ...publishState,
      isPublishing: true,
      error: null
    });

    try {
      // Add scheduled time if in scheduling mode
      const scheduledTime = publishState.isScheduling && publishState.scheduledTime
        ? new Date(publishState.scheduledTime).toISOString()
        : undefined;

      // Make the API request to publish the site
      const response = await webflowAPI.publishSite(modal.page.siteId, scheduledTime, selectedProject.token);

      // Handle success
      setPublishState({
        ...publishState,
        isPublishing: false,
        isSuccess: true,
        error: null
      });

      // Close the modal after 3 seconds
      setTimeout(() => {
        closePublishModal();
      }, 3000);
    } catch (err: any) {
      console.error('Error publishing site:', err);
      
      // Handle error
      setPublishState({
        ...publishState,
        isPublishing: false,
        error: err.response?.data?.message || err.message || 'Failed to publish site'
      });
    }
  };

  const closeDomModal = () => {
    setDomModal({
      isOpen: false,
      page: null,
      domContent: null
    });
  };

  // Define formatDomContent function
  const formatDomContent = (content: any): { __html: string } => {
    if (!content) return { __html: 'No content available' };
    
    try {
      // If it's a DOM structure, format it nicely
      if (typeof content === 'object') {
        const prettyJson = JSON.stringify(content, null, 2);
        
        // Use syntax highlighting by replacing HTML tags with colored spans
        const highlighted = prettyJson
          .replace(/"tag":/g, '"<span style="color: #e91e63">tag</span>":')
          .replace(/"children":/g, '"<span style="color: #4caf50">children</span>":')
          .replace(/"attributes":/g, '"<span style="color: #2196f3">attributes</span>":')
          .replace(/"class":/g, '"<span style="color: #ff9800">class</span>":')
          .replace(/"style":/g, '"<span style="color: #9c27b0">style</span>":')
          .replace(/"content":/g, '"<span style="color: #795548">content</span>":');
          
        return { __html: highlighted };
      }
      
      return { __html: String(content) };
    } catch (e) {
      return { __html: String(content) };
    }
  };

  // Update the DOM modal with better formatting
  const renderDomModal = () => {
    if (!domModal.isOpen) return null;
    
    const { page, domContent, error } = domModal;
    
    return (
      <ModalOverlay onClick={closeDomModal}>
        <ModalContent onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '1400px', maxHeight: '90vh' }}>
          <ModalHeader>
            <ModalTitle>
              <span style={{ fontSize: '0.8em', marginRight: '8px' }}>🧩</span>
              {page?.title || 'Page DOM'} - DOM Structure
            </ModalTitle>
            <CloseButton onClick={closeDomModal}>×</CloseButton>
          </ModalHeader>
          
          <ModalBody style={{ maxHeight: 'calc(90vh - 130px)', overflow: 'auto' }}>
            {loadingDom ? (
              <LoadingMessage>Loading page DOM...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : !domContent ? (
              <ErrorMessage>Failed to load page DOM content</ErrorMessage>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f0f3f6',
                  borderRadius: '4px'
                }}>
                  <strong>DOM Structure for: {page?.slug}</strong>
                  <span>Site: {page?.siteName}</span>
                </div>
                <DomViewer dangerouslySetInnerHTML={formatDomContent(domContent)} />
              </div>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={closeDomModal}>Close</Button>
            {!error && !loadingDom && domContent && (
              <Button 
                primary
                onClick={() => {
                  // Download DOM content as JSON file
                  const blob = new Blob([JSON.stringify(domContent, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dom-${page?.slug || 'page'}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Download JSON
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  };

  // Merge 'Show Custom Code' option into the existing renderDropdown function
  const renderDropdown = (pageId: string | null) => {
    if (!pageId || activeDropdown !== pageId) return null;
    const isLoading = loadingAction.pageId === pageId;
    return (
      <DropdownContainer 
        className="dropdown-menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) handleMenuOptionClick('details', pageId);
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
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) handleMenuOptionClick('dom', pageId);
          }} 
          className={`dropdown-item ${isLoading && loadingAction.type === 'dom' ? 'loading' : ''}`}
          style={{ opacity: isLoading && loadingAction.type !== 'dom' ? 0.5 : 1 }}
        >
          {isLoading && loadingAction.type === 'dom' ? (
            <LoadingSpinner size="small" />
          ) : (
            <span role="img" aria-label="DOM">🧩</span>
          )} View DOM
        </div>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoading) handleMenuOptionClick('publish', pageId);
          }} 
          className={`dropdown-item ${isLoading && loadingAction.type === 'publish' ? 'loading' : ''}`}
          style={{ opacity: isLoading && loadingAction.type !== 'publish' ? 0.5 : 1 }}
        >
          {isLoading && loadingAction.type === 'publish' ? (
            <LoadingSpinner size="small" />
          ) : (
            <span role="img" aria-label="Publish">📤</span>
          )} Publish Page
        </div>
      </DropdownContainer>
    );
  };

  // Update the action cell in renderTableRow to prevent click propagation
  const renderTableRow = (page: WebflowPage) => {
    const { url, isPublished } = getPageUrl(page);
    const hasLink = !!url;
    const isMenuOpen = dropdown.isOpen && dropdown.pageId === page.id;
    
    return (
      <StyledTableRow 
        key={page.id} 
        $isCmsPage={isCollectionPage(page)}
        className={hasLink ? "clickable-row" : ""}
        onClick={hasLink ? () => window.open(url, '_blank') : undefined}
        style={hasLink ? { cursor: 'pointer' } : {}}
      >
        <TableCell>
          <span>{page.title}</span>
          {hasLink && (
            <LinkIcon title={isPublished ? "View published page" : "Open in Webflow Editor"}>
              {isPublished ? "🌐" : "⟳"}
            </LinkIcon>
          )}
        </TableCell>
        <TableCell>{page.slug}</TableCell>
        <TableCell>{formatDate(page.lastUpdated)}</TableCell>
        <TableCell>
          <PageTypeTag isCmsPage={isCollectionPage(page)}>
            {isCollectionPage(page) ? 'CMS' : 'Static'}
          </PageTypeTag>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div style={{ position: 'relative' }}>
            <ActionButtons>
              {page.url && (
                <ActionButton 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(page.url, '_blank');
                  }}
                  title="View published page"
                >
                  <span role="img" aria-label="View">👁️</span>
                </ActionButton>
              )}
              
              {page.previewUrl && (
                <ActionButton 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(page.previewUrl, '_blank');
                  }}
                  title="Open in Webflow Editor"
                >
                  <span role="img" aria-label="Edit">✏️</span>
                </ActionButton>
              )}
              
              <ActionButton 
                onClick={(e) => handleMenuClick(e, page.id)}
                title="More options"
                className="menu-trigger"
              >
                <span>⋮</span>
              </ActionButton>
            </ActionButtons>
            {activeDropdown === page.id && renderDropdown(page.id)}
          </div>
        </TableCell>
      </StyledTableRow>
    );
  };

  // Render the page details modal
  const renderPageDetailsModal = () => {
    if (!modal.isOpen) return null;
    
    const { page, pageDetails, error } = modal;
    
    // Format date properly
    const formatDate = (dateString: string) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return date.toLocaleString();
      } catch (e) {
        return dateString;
      }
    };
    
    // Extract page data from the response
    const pageData = pageDetails?.page || page;
    
    return (
      <ModalOverlay onClick={closeModal}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>{pageData?.title || 'Page Details'}</ModalTitle>
            <CloseButton onClick={closeModal}>×</CloseButton>
          </ModalHeader>
          
          <ModalBody>
            {loadingDetails ? (
              <LoadingMessage>Loading page details...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : !pageData ? (
              <ErrorMessage>Failed to load page details</ErrorMessage>
            ) : (
              <DetailsGrid>
                <DetailItem>
                  <DetailLabel>Page ID</DetailLabel>
                  <DetailValue>{pageData.id}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Title</DetailLabel>
                  <DetailValue>{pageData.title}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Slug</DetailLabel>
                  <DetailValue>{pageData.slug}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Last Updated</DetailLabel>
                  <DetailValue>{formatDate(pageData.lastUpdated)}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Site</DetailLabel>
                  <DetailValue>{pageData.siteName}</DetailValue>
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Type</DetailLabel>
                  <DetailValue>
                    <PageTypeTag isCmsPage={Boolean(pageData.collectionId)}>
                      {Boolean(pageData.collectionId) ? 'CMS Template' : 'Static Page'}
                    </PageTypeTag>
                  </DetailValue>
                </DetailItem>
                
                {pageData.parentId && (
                  <DetailItem>
                    <DetailLabel>Parent Page ID</DetailLabel>
                    <DetailValue>{pageData.parentId}</DetailValue>
                  </DetailItem>
                )}
                
                {pageData.createdOn && (
                  <DetailItem>
                    <DetailLabel>Created On</DetailLabel>
                    <DetailValue>{formatDate(pageData.createdOn)}</DetailValue>
                  </DetailItem>
                )}
                
                {pageData.archived !== undefined && (
                  <DetailItem>
                    <DetailLabel>Archived</DetailLabel>
                    <DetailValue>{pageData.archived ? 'Yes' : 'No'}</DetailValue>
                  </DetailItem>
                )}
                
                {pageData.draft !== undefined && (
                  <DetailItem>
                    <DetailLabel>Draft</DetailLabel>
                    <DetailValue>{pageData.draft ? 'Yes' : 'No'}</DetailValue>
                  </DetailItem>
                )}
                
                {pageData.publishedPath && (
                  <DetailItem>
                    <DetailLabel>Published Path</DetailLabel>
                    <DetailValue>{pageData.publishedPath}</DetailValue>
                  </DetailItem>
                )}
                
                {pageData.seo && (
                  <DetailItem span={2}>
                    <DetailLabel>SEO</DetailLabel>
                    <DetailValue>
                      <div><strong>Title:</strong> {pageData.seo.title || 'None'}</div>
                      <div><strong>Description:</strong> {pageData.seo.description || 'None'}</div>
                    </DetailValue>
                  </DetailItem>
                )}
                
                {pageData.openGraph && (
                  <DetailItem span={2}>
                    <DetailLabel>Open Graph</DetailLabel>
                    <DetailValue>
                      <div><strong>Title:</strong> {pageData.openGraph.title || 'Same as SEO'}</div>
                      <div><strong>Description:</strong> {pageData.openGraph.description || 'Same as SEO'}</div>
                    </DetailValue>
                  </DetailItem>
                )}
                
                {/* URLs */}
                {pageData.url && (
                  <DetailItem>
                    <DetailLabel>Published URL</DetailLabel>
                    <DetailValue>
                      <DetailLink href={pageData.url} target="_blank" rel="noopener noreferrer">
                        {pageData.url} <span>↗</span>
                      </DetailLink>
                    </DetailValue>
                  </DetailItem>
                )}
                
                {pageData.previewUrl && (
                  <DetailItem>
                    <DetailLabel>Editor URL</DetailLabel>
                    <DetailValue>
                      <DetailLink href={pageData.previewUrl} target="_blank" rel="noopener noreferrer">
                        Open in Editor <span>↗</span>
                      </DetailLink>
                    </DetailValue>
                  </DetailItem>
                )}
              </DetailsGrid>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={closeModal}>Close</Button>
            {!error && !loadingDetails && pageData && (
              <>
                {(pageData.url || pageData.previewUrl) && (
                  <Button 
                    primary
                    onClick={() => window.open(pageData.url || pageData.previewUrl, '_blank')}
                  >
                    Open Page
                  </Button>
                )}
                <Button 
                  primary
                  onClick={openPublishModal}
                >
                  Publish
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  };

  // Add the publish modal component
  const renderPublishModal = () => {
    if (!publishState.isOpen) return null;
    
    return (
      <ModalOverlay onClick={closePublishModal}>
        <ModalContent onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
          <ModalHeader>
            <ModalTitle>Publish Site</ModalTitle>
            <CloseButton onClick={closePublishModal}>×</CloseButton>
          </ModalHeader>
          
          <ModalBody>
            {publishState.isSuccess ? (
              <SuccessMessage>
                {publishState.isScheduling 
                  ? 'Publication scheduled successfully!' 
                  : 'Site published successfully!'}
              </SuccessMessage>
            ) : (
              <>
                <p>
                  You are about to publish the site containing page: <strong>{modal.page?.title}</strong>
                </p>
                
                <ScheduleToggle>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={publishState.isScheduling}
                      onChange={toggleScheduling}
                    />
                    Schedule for later
                  </label>
                </ScheduleToggle>
                
                {publishState.isScheduling && (
                  <ScheduleContainer>
                    <label htmlFor="scheduled-time">Scheduled Time:</label>
                    <input
                      id="scheduled-time"
                      type="datetime-local"
                      value={publishState.scheduledTime}
                      onChange={handleScheduledTimeChange}
                      min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    />
                    
                    <QuickTimeOptions>
                      <QuickTimeButton onClick={() => setQuickTime(15)}>+15 min</QuickTimeButton>
                      <QuickTimeButton onClick={() => setQuickTime(30)}>+30 min</QuickTimeButton>
                      <QuickTimeButton onClick={() => setQuickTime(60)}>+1 hour</QuickTimeButton>
                      <QuickTimeButton onClick={() => setQuickTime(24 * 60)}>+1 day</QuickTimeButton>
                    </QuickTimeOptions>
                  </ScheduleContainer>
                )}
                
                {publishState.error && <ErrorMessage>{publishState.error}</ErrorMessage>}
              </>
            )}
          </ModalBody>
          
          <ModalFooter>
            {!publishState.isSuccess && (
              <>
                <Button onClick={closePublishModal}>Cancel</Button>
                <Button 
                  primary
                  disabled={publishState.isPublishing}
                  onClick={handlePublish}
                >
                  {publishState.isPublishing ? 'Publishing...' : publishState.isScheduling ? 'Schedule' : 'Publish Now'}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  };

  // DomViewer component is already defined at the bottom, add LoadingSpinner right after it
  const DomViewer = styled.pre`
    background-color: #282c34;
    color: #abb2bf;
    padding: 20px;
    border-radius: 4px;
    font-family: 'Fira Code', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
    tab-size: 2;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
    
    span {
      display: inline;
    }
  `;

  // Add the loading spinner component here with the other styled components
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

  // Move StyledTableRow definition after TableRow
  const TableRow = styled.tr<TableRowProps>`
    &:not(:last-child) {
      border-bottom: 1px solid var(--border-color);
    }
    ${props => props.$isCmsPage && `
      background-color: var(--background-light);
    `}
    &.cms-item-row {
      background-color: var(--background-light);
    }
  `;

  const StyledTableRow: React.FC<React.PropsWithChildren<TableRowProps & React.HTMLAttributes<HTMLTableRowElement>>> = 
    ({ $isCmsPage, children, ...rest }) => {
      // Filter out custom props before passing to DOM element
      const domProps = { ...rest };
      return (
        <TableRow $isCmsPage={$isCmsPage} {...domProps}>
          {children}
        </TableRow>
      );
    };

  // Add a styled span for the arrow
  const CmsItemArrow = styled.span`
    color: var(--text-tertiary);
    margin-right: 0.25rem;
  `;

  // Add a styled DraftBadge
  const DraftBadge = styled.span`
    background-color: #f0ad4e;
    color: white;
    font-size: 0.7em;
    font-weight: 600;
    border-radius: 4px;
    padding: 2px 6px;
    margin-left: 8px;
    vertical-align: middle;
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
                <PageTitle>Webflow Pages</PageTitle>
                <PageDescription>
                  Browse all pages from your connected Webflow sites
                </PageDescription>
              </div>
              <ExportButton onClick={exportToCSV} disabled={filteredPages.length === 0}>
                Export to CSV
              </ExportButton>
            </PageHeader>

            <FiltersContainer>
              <SearchInput 
                type="text" 
                placeholder="Search pages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FilterCheckbox>
                <input 
                  type="checkbox" 
                  checked={showCmsPages} 
                  id="showCmsPages"
                  onChange={() => setShowCmsPages(!showCmsPages)} 
                />
                <label htmlFor="showCmsPages">Show CMS Template Pages</label>
              </FilterCheckbox>
            </FiltersContainer>

            {loading ? (
              <LoadingMessage>Loading pages...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : filteredPages.length === 0 ? (
              <NoDataMessage>
                {pages.length === 0 
                  ? "No pages found in your Webflow projects." 
                  : "No pages match your search criteria."}
              </NoDataMessage>
            ) : (
              <>
                <PageCount>{filteredPages.length} of {pages.length} pages</PageCount>
                <PagesTable>
                  <thead>
                    <TableRow>
                      <TableHeader onClick={() => handleSort('title')}>
                        Name {sortConfig.key === 'title' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('slug')}>
                        Slug {sortConfig.key === 'slug' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader onClick={() => handleSort('lastUpdated')}>
                        Last Updated {sortConfig.key === 'lastUpdated' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </thead>
                  <tbody>
                    {filteredPages.flatMap(renderTableRowWithCmsItems)}
                  </tbody>
                </PagesTable>
              </>
            )}
          </>
        )
      }
      {renderPageDetailsModal()}
      {renderPublishModal()}
      {renderDomModal()}
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

const FiltersContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  min-width: 250px;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }
`;

const FilterCheckbox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  
  input {
    margin: 0;
  }
`;

const PagesTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  overflow: hidden;
`;

interface TableRowProps {
  $isCmsPage?: boolean;
}

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
  &:first-child {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  &.cms-item-cell {
    padding-left: 40px;
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

const PageCount = styled.div`
  margin-bottom: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

interface PageTypeTagProps {
  isCmsPage: boolean;
}

const PageTypeTagStyled = styled.span<PageTypeTagProps>`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-wrap: nowrap;
  text-align: center;
  
  ${props => props.isCmsPage ? `
    background-color: rgba(62, 152, 229, 0.2);
    color: #2370b8;
  ` : `
    background-color: rgba(72, 187, 120, 0.2);
    color: #2f855a;
  `}
`;

// Ensure this component filters out custom props
const PageTypeTag: React.FC<React.PropsWithChildren<PageTypeTagProps>> = 
  ({ isCmsPage, children }) => (
    <PageTypeTagStyled isCmsPage={isCmsPage}>
      {children}
    </PageTypeTagStyled>
  );

const LinkIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color, #3e98e5);
  opacity: 0.7;
  font-size: 0.75rem;
  margin-left: 0.25rem;
`;

const ExportButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: var(--primary-hover);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// New styled components for dropdown and modal
const ActionCell = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
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
  box-shadow: 0 2px 20px var(--shadow-color, rgba(0, 0, 0, 0.15));
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

const ApiNote = styled.span`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 500;
`;

const ScheduleToggle = styled.div`
  margin: 15px 0;
  display: flex;
  align-items: center;

  label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  input {
    margin-right: 8px;
  }
`;

const ScheduleContainer = styled.div`
  margin: 15px 0;
  padding: 15px;
  background-color: var(--gray-surface);
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background-color: var(--bg-color-card);
    color: rgb(var(--body-text));
  }
`;

const QuickTimeOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const QuickTimeButton = styled.button`
  padding: 6px 12px;
  background-color: var(--accent-3);
  color: rgb(var(--body-text));
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--accent-5);
  }
`;

const SuccessMessage = styled.div`
  padding: 15px;
  background-color: #e6f7e6;
  color: #2e7d32;
  border-radius: 4px;
  text-align: center;
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

export default Pages; 