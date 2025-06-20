import React, { useState, useEffect, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { webflowAPI } from '../api/apiClient';
import axios from 'axios';
import SparkMD5 from 'spark-md5';
import { Project } from './Dashboard';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useProjectContext } from '../contexts/ProjectContext';
import { recordActivity } from '../services/activityLogService';

// Extend the User type locally to include webflowToken
interface UserWithWebflowToken extends SupabaseUser {
  webflowToken?: string;
  tokenName?: string;
}

// Original API response asset interface
interface ApiWebflowAsset {
  id: string;
  contentType: string;
  size: number;
  siteId: string;
  hostedUrl: string;
  originalFileName: string;
  displayName: string;
  lastUpdated: string;
  createdOn: string;
  variants?: Array<{
    hostedUrl: string;
    originalFileName: string;
    displayName: string;
    format: string;
    width?: number;
    height?: number;
    quality?: number;
  }>;
  altText?: string;
  width?: number;
  height?: number;
}

// Processed asset for our UI
interface WebflowAsset {
  id: string;
  name: string;
  fileName: string;
  fileSize: number; 
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  created: string;
  lastUpdated: string;
  siteName?: string;
  siteId?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  isImage?: boolean;
  altText?: string;
}

interface ModalState {
  isOpen: boolean;
  asset: WebflowAsset | null;
}

interface UploadModalState {
  isOpen: boolean;
  isUploading: boolean;
  file: File | null;
  altText: string;
  progress: number;
  error: string;
  success: boolean;
}

// --- Bulk Upload State ---
interface BulkUploadFile {
  file: File;
  altText: string;
  progress: number;
  error: string;
  success: boolean;
}

const Assets: React.FC = () => {
  const { token, user: rawUser } = useAuth();
  const user = rawUser as UserWithWebflowToken | null;
  const { projects, selectedProject, setSelectedProject, loading: projectsLoading } = useProjectContext();
  if (!user?.user_metadata?.premium) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>
        Assets are available only for premium users.
      </div>
    );
  }
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [assets, setAssets] = useState<WebflowAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<WebflowAsset[]>([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    asset: null
  });
  const [uploadModal, setUploadModal] = useState<UploadModalState>({
    isOpen: false,
    isUploading: false,
    file: null,
    altText: '',
    progress: 0,
    error: '',
    success: false
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WebflowAsset;
    direction: 'ascending' | 'descending';
  }>({ key: 'name', direction: 'ascending' });
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>({
    'image': true,
    'svg': true,
    'document': true,
    'video': true,
    'audio': true,
    'other': true
  });
  const [altTextFilter, setAltTextFilter] = useState<'all' | 'with-alt' | 'without-alt'>('all');
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [editingAltText, setEditingAltText] = useState(false);
  const [altTextInput, setAltTextInput] = useState('');
  const [altTextLoading, setAltTextLoading] = useState(false);
  const [altTextError, setAltTextError] = useState('');
  const [bulkUploadFiles, setBulkUploadFiles] = useState<BulkUploadFile[]>([]);
  const [inlineEditingAssetId, setInlineEditingAssetId] = useState<string | null>(null);
  const [inlineAltTextInput, setInlineAltTextInput] = useState('');
  const [inlineAltTextLoading, setInlineAltTextLoading] = useState(false);
  const [inlineAltTextError, setInlineAltTextError] = useState('');

  // Fetch sites on component mount or when selectedProject changes
  useEffect(() => {
    const fetchSites = async () => {
      if (!selectedProject?.token) return;
      console.log('[Assets] Fetching sites with token:', selectedProject.token);
      try {
        const response = await webflowAPI.getSites(selectedProject.token);
        setSites(response.data.sites || []);
        if (response.data.sites && response.data.sites.length > 0) {
          setSelectedSite(response.data.sites[0].id);
        }
      } catch (err) {
        console.error('[Assets] Failed to fetch sites:', err);
        setError('Failed to fetch sites');
      }
    };
    fetchSites();
  }, [selectedProject]);

  // Fetch assets when a site is selected
  useEffect(() => {
    if (selectedSite && selectedProject?.token) {
      fetchAssets(selectedSite);
    }
  }, [selectedSite, selectedProject]);

  // Filter assets when search term, assets, type filters, or alt text filter change
  useEffect(() => {
    // Apply filtering and sorting
    let result = [...assets];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (asset: WebflowAsset) => 
          asset.name?.toLowerCase().includes(term) || 
          asset.fileName?.toLowerCase().includes(term) ||
          asset.mimeType?.toLowerCase().includes(term) ||
          asset.altText?.toLowerCase().includes(term)
      );
    }
    
    // Filter by alt text presence
    if (altTextFilter === 'with-alt') {
      result = result.filter((asset: WebflowAsset) => asset.altText && asset.altText.trim().length > 0);
    } else if (altTextFilter === 'without-alt') {
      result = result.filter((asset: WebflowAsset) => !asset.altText || asset.altText.trim().length === 0);
    }
    
    // Check if any type filter is enabled
    const anyFilterEnabled = Object.values(typeFilters).some(value => value);
    
    // Only apply type filtering if at least one filter is enabled
    if (anyFilterEnabled) {
      // Filter by type
      result = result.filter((asset: WebflowAsset) => {
        const mimeType = asset.mimeType.toLowerCase();
        
        if (mimeType.startsWith('image/svg') && typeFilters['svg']) {
          return true;
        } else if (mimeType.startsWith('image/') && !mimeType.includes('svg') && typeFilters['image']) {
          return true;
        } else if ((mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/')) && typeFilters['document']) {
          return true;
        } else if (mimeType.startsWith('video/') && typeFilters['video']) {
          return true;
        } else if (mimeType.startsWith('audio/') && typeFilters['audio']) {
          return true;
        } else if (!mimeType.startsWith('image/') && 
                  !mimeType.includes('pdf') && 
                  !mimeType.includes('document') && 
                  !mimeType.startsWith('video/') && 
                  !mimeType.startsWith('audio/') && 
                  typeFilters['other']) {
          return true;
        }
        
        return false;
      });
    }
    
    // Apply sorting
    result.sort((a: WebflowAsset, b: WebflowAsset) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
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
    
    setFilteredAssets(result);
  }, [assets, searchTerm, sortConfig, typeFilters, altTextFilter]);

  const fetchAssets = async (siteId: string) => {
    if (!selectedProject?.token) return;
    setError('');
    
    try {
      console.log('[Assets] Fetching assets for site:', siteId, 'with token:', selectedProject.token);
      const response = await webflowAPI.getAssets(siteId, selectedProject.token);
      console.log('API response:', response.data);
      
      // Process assets
      const processedAssets = (response.data.assets || []).map((asset: ApiWebflowAsset) => {
        console.log('Processing asset:', asset);
        return {
          id: asset.id,
          name: asset.displayName || asset.originalFileName || 'Unnamed Asset',
          fileName: asset.originalFileName || '',
          fileSize: asset.size || 0,
          url: asset.hostedUrl || '',
          mimeType: asset.contentType || '',
          created: asset.createdOn || '',
          lastUpdated: asset.lastUpdated || '',
          siteName: response.data.siteName || 'Unknown Site',
          siteId: asset.siteId || siteId,
          dimensions: asset.width && asset.height ? { 
            width: asset.width, 
            height: asset.height 
          } : undefined,
          isImage: asset.contentType?.startsWith('image/') || false,
          altText: asset.altText ? asset.altText.trim() : '',  // Trim alt text from API
          thumbnailUrl: asset.variants && asset.variants.length > 0 ? 
            asset.variants[0].hostedUrl : 
            asset.hostedUrl
        };
      });
      
      console.log('Processed assets:', processedAssets);
      setAssets(processedAssets);
      
      // Identify available types in the dataset
      const types = new Set<string>();
      processedAssets.forEach((asset: WebflowAsset) => {
        const mimeType = asset.mimeType.toLowerCase();
        if (mimeType.startsWith('image/svg')) {
          types.add('svg');
        } else if (mimeType.startsWith('image/')) {
          types.add('image');
        } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/')) {
          types.add('document');
        } else if (mimeType.startsWith('video/')) {
          types.add('video');
        } else if (mimeType.startsWith('audio/')) {
          types.add('audio');
        } else {
          types.add('other');
        }
      });
      
      setAvailableTypes(Array.from(types));
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      setError(err.response?.data?.message || 'Failed to fetch assets');
    }
  };

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSite(e.target.value);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSort = (key: keyof WebflowAsset) => {
    setSortConfig({
      key,
      direction: 
        sortConfig.key === key && sortConfig.direction === 'ascending' 
          ? 'descending' 
          : 'ascending'
    });
  };

  const openAssetModal = (asset: WebflowAsset) => {
    setModal({
      isOpen: true,
      asset
    });
    
    // Add escape key listener when modal opens
    document.addEventListener('keydown', handleAssetModalEscapeKey);
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      asset: null
    });
    
    // Remove escape key listener when modal closes
    document.removeEventListener('keydown', handleAssetModalEscapeKey);
  };
  
  // Handle escape key press to close asset modal
  const handleAssetModalEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && modal.isOpen) {
      closeModal();
    }
  }, [modal.isOpen]);
  
  // Clean up event listener when component unmounts or when dependencies change
  useEffect(() => {
    // Add listener if modal is open
    if (modal.isOpen) {
      document.addEventListener('keydown', handleAssetModalEscapeKey);
      
      // Remove listener when component unmounts or dependencies change
      return () => {
        document.removeEventListener('keydown', handleAssetModalEscapeKey);
      };
    }
  }, [modal.isOpen, handleAssetModalEscapeKey]);

  const getAssetTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('css') || mimeType.includes('html')) return '📝';
    return '📎';
  };

  const getDisplayAltText = (altText?: string) => {
    if (!altText) return '';
    const trimmed = altText.trim();
    return trimmed.length > 0 ? trimmed : '';
  };

  const renderAssetModal = () => {
    const { asset } = modal;
    if (!asset) return null;
    const displayAltText = getDisplayAltText(asset.altText);
    const canEditAlt = asset.isImage;

    const handleEditAltClick = () => {
      setAltTextError('');
      setAltTextInput(asset.altText || '');
      setEditingAltText(true);
    };
    const handleCancelEditAlt = () => {
      setEditingAltText(false);
      setAltTextError('');
    };
    const handleSaveAltText = async () => {
      setAltTextLoading(true);
      setAltTextError('');
      
      try {
        await webflowAPI.updateAssetAltText(
          asset.id, 
          altTextInput.trim(),
          selectedProject?.token,
          asset.name
        );
        
        // Log the activity
        if (selectedProject?.id) {
          await recordActivity(
            selectedProject.id,
            'update_alt_text',
            'asset',
            asset.id,
            { altText: asset.altText },
            { altText: altTextInput.trim() }
          );
        }
        
        // Update asset in state
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, altText: altTextInput.trim() } : a));
        setFilteredAssets(prev => prev.map(a => a.id === asset.id ? { ...a, altText: altTextInput.trim() } : a));
        setModal(m => m.asset ? { ...m, asset: { ...m.asset, altText: altTextInput.trim() } } : m);
        setEditingAltText(false);
      } catch (err: any) {
        setAltTextError(err?.response?.data?.message || 'Failed to update alt text');
      } finally {
        setAltTextLoading(false);
      }
    };

    return (
      <ModalOverlay onClick={closeModal}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              {getAssetTypeIcon(asset.mimeType)} {asset.name}
            </ModalTitle>
            <CloseButton onClick={closeModal}>×</CloseButton>
          </ModalHeader>
          
          <ModalBody>
            {asset.isImage ? (
              <AssetPreview>
                <AssetImage src={asset.thumbnailUrl || asset.url} alt={displayAltText || asset.name} />
                <ImageAltText>
                  <AltTextLabel>Alt Text:</AltTextLabel>
                  {editingAltText ? (
                    <>
                      <Input
                        type="text"
                        value={altTextInput}
                        onChange={e => setAltTextInput(e.target.value)}
                        disabled={altTextLoading}
                        style={{ minWidth: 200 }}
                        maxLength={255}
                        autoFocus
                      />
                      <Button primary onClick={handleSaveAltText} disabled={altTextLoading || altTextInput.trim() === (asset.altText || '').trim()}>
                        {altTextLoading ? 'Saving...' : 'Save'}
                      </Button>
                      <Button onClick={handleCancelEditAlt} disabled={altTextLoading}>Cancel</Button>
                      {altTextError && <AltTextMissing>{altTextError}</AltTextMissing>}
                    </>
                  ) : displayAltText ? (
                    <>
                      <AltTextValue>{displayAltText}</AltTextValue>
                      {canEditAlt && <Button onClick={handleEditAltClick} style={{ marginLeft: 8 }}>Edit</Button>}
                    </>
                  ) : (
                    <>
                      <AltTextMissing>No alt text set for this image</AltTextMissing>
                      {canEditAlt && <Button onClick={handleEditAltClick} style={{ marginLeft: 8 }}>Add Alt Text</Button>}
                    </>
                  )}
                </ImageAltText>
              </AssetPreview>
            ) : (
              <AssetPreview>
                <AssetIcon>{getAssetTypeIcon(asset.mimeType)}</AssetIcon>
                <AssetFileName>{asset.fileName}</AssetFileName>
              </AssetPreview>
            )}
            
            <DetailsGrid>
              <DetailItem>
                <DetailLabel>Display Name</DetailLabel>
                <DetailValue>{asset.name}</DetailValue>
              </DetailItem>
              
              <DetailItem>
                <DetailLabel>Original File Name</DetailLabel>
                <DetailValue>{asset.fileName}</DetailValue>
              </DetailItem>
              
              <DetailItem>
                <DetailLabel>File Size</DetailLabel>
                <DetailValue>{formatFileSize(asset.fileSize)}</DetailValue>
              </DetailItem>
              
              <DetailItem>
                <DetailLabel>MIME Type</DetailLabel>
                <DetailValue>{asset.mimeType}</DetailValue>
              </DetailItem>
              
              {asset.dimensions && (
                <DetailItem>
                  <DetailLabel>Dimensions</DetailLabel>
                  <DetailValue>{asset.dimensions.width} × {asset.dimensions.height}</DetailValue>
                </DetailItem>
              )}
              
              <DetailItem>
                <DetailLabel>Created</DetailLabel>
                <DetailValue>{formatDate(asset.created)}</DetailValue>
              </DetailItem>
              
              <DetailItem>
                <DetailLabel>Last Updated</DetailLabel>
                <DetailValue>{formatDate(asset.lastUpdated)}</DetailValue>
              </DetailItem>
              
              <DetailItem>
                <DetailLabel>Site</DetailLabel>
                <DetailValue>{asset.siteName}</DetailValue>
              </DetailItem>
              
              <DetailItem span={2}>
                <DetailLabel>Hosted URL</DetailLabel>
                <DetailValue>
                  <AssetUrl href={asset.url} target="_blank" rel="noopener noreferrer">
                    {asset.url} <span>↗</span>
                  </AssetUrl>
                </DetailValue>
              </DetailItem>
            </DetailsGrid>
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={closeModal}>Close</Button>
            <Button primary onClick={() => window.open(asset.url, '_blank')}>
              Open Asset
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  };

  const handleTypeFilterChange = (type: string) => {
    setTypeFilters(prev => {
      const newFilters = {
        ...prev,
        [type]: !prev[type]
      };
      
      // Prevent deselecting all filters - keep at least one selected
      const hasAnySelected = Object.values(newFilters).some(value => value);
      if (!hasAnySelected) {
        return prev; // Don't allow the change if it would deselect all
      }
      
      return newFilters;
    });
  };

  const selectAllFilters = () => {
    const allEnabled = Object.fromEntries(
      Object.keys(typeFilters).map(key => [key, true])
    );
    setTypeFilters(allEnabled);
  };

  const deselectAllFilters = () => {
    // Instead of deselecting all, keep the first available type selected
    const availableFilterKeys = Object.keys(typeFilters).filter(key => 
      availableTypes.includes(key)
    );
    
    if (availableFilterKeys.length === 0) return; // No filters to modify
    
    const newFilters = Object.fromEntries(
      Object.keys(typeFilters).map(key => [
        key, 
        key === availableFilterKeys[0] // Keep the first available type selected
      ])
    );
    setTypeFilters(newFilters);
  };

  const openUploadModal = () => {
    setUploadModal({
      isOpen: true,
      isUploading: false,
      file: null,
      altText: '',
      progress: 0,
      error: '',
      success: false
    });
    setBulkUploadFiles([]);
    
    // Add escape key listener when modal opens
    document.addEventListener('keydown', handleEscapeKey);
  };

  const closeUploadModal = () => {
    if (uploadModal.isUploading) return;
    
    setUploadModal({
      ...uploadModal,
      isOpen: false
    });
    
    // Remove escape key listener when modal closes
    document.removeEventListener('keydown', handleEscapeKey);
  };
  
  // Handle escape key press to close modal
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && uploadModal.isOpen && !uploadModal.isUploading) {
      closeUploadModal();
    }
  }, [uploadModal.isOpen, uploadModal.isUploading]);
  
  // Clean up event listener when component unmounts or when dependencies change
  useEffect(() => {
    // Add listener if modal is open
    if (uploadModal.isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      
      // Remove listener when component unmounts or dependencies change
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [uploadModal.isOpen, handleEscapeKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setBulkUploadFiles(files.map(file => ({ file, altText: '', progress: 0, error: '', success: false })));
      setUploadModal(prev => ({ ...prev, file: null })); // clear single file
    }
  };

  const handleBulkAltTextChange = (idx: number, value: string) => {
    setBulkUploadFiles(prev => prev.map((f, i) => i === idx ? { ...f, altText: value } : f));
  };

  const handleBulkUpload = async () => {
    if (!selectedSite || bulkUploadFiles.length === 0 || !selectedProject?.token) {
      setUploadModal(prev => ({ 
        ...prev, 
        error: 'Please select a site, project, and files to upload' 
      }));
      return;
    }
    setUploadModal(prev => ({ ...prev, isUploading: true, error: '' }));
    const updatedFiles = [...bulkUploadFiles];
    for (let i = 0; i < updatedFiles.length; i++) {
      const f = updatedFiles[i];
      try {
        updatedFiles[i].progress = 10;
        setBulkUploadFiles([...updatedFiles]);
        const fileBuffer = await f.file.arrayBuffer();
        const fileHash = SparkMD5.ArrayBuffer.hash(fileBuffer);
        const fileName = f.file.name;
        const metaRes = await webflowAPI.createAssetMetadata(
          selectedSite, 
          fileName, 
          fileHash,
          selectedProject.token
        );
        updatedFiles[i].progress = 30;
        setBulkUploadFiles([...updatedFiles]);
        const { uploadUrl, uploadDetails, id: assetId } = metaRes.data;
        const s3Form = new FormData();
        Object.entries(uploadDetails).forEach(([key, value]) => {
          s3Form.append(key, value as string);
        });
        s3Form.append('file', f.file);
        await fetch(uploadUrl, { method: 'POST', body: s3Form });
        updatedFiles[i].progress = 80;
        setBulkUploadFiles([...updatedFiles]);
        
        // Prepare asset data for logging
        const assetData = {
          fileName: f.file.name,
          fileSize: f.file.size,
          fileType: f.file.type
        };
        
        if (f.altText && assetId) {
          await webflowAPI.updateAssetAltText(
            assetId, 
            f.altText, 
            selectedProject.token,
            f.file.name
          );
          
          // Log alt text setting activity if altText is provided
          if (selectedProject?.id) {
            await recordActivity(
              selectedProject.id,
              'update_alt_text',
              'asset',
              assetId,
              null,
              { ...assetData, altText: f.altText }
            );
          }
        }
        
        // Log upload activity
        if (selectedProject?.id && assetId) {
          await recordActivity(
            selectedProject.id,
            'upload_asset',
            'asset',
            assetId,
            null,
            assetData
          );
        }
        
        updatedFiles[i].progress = 100;
        updatedFiles[i].success = true;
        updatedFiles[i].error = '';
        setBulkUploadFiles([...updatedFiles]);
      } catch (err: any) {
        updatedFiles[i].progress = 0;
        updatedFiles[i].error = err.response?.data?.message || err.message || 'Failed to upload asset';
        updatedFiles[i].success = false;
        setBulkUploadFiles([...updatedFiles]);
      }
    }
    setUploadModal(prev => ({ ...prev, isUploading: false, success: updatedFiles.every(f => f.success) }));
    // Refresh asset list after all uploads
    setTimeout(() => {
      fetchAssets(selectedSite);
      setUploadModal(prev => ({ ...prev, isOpen: false }));
    }, 2000);
  };

  const downloadCSV = async () => {
    if (!selectedSite || !selectedProject?.token) {
      setError('Please select a site and project first');
      return;
    }
    try {
      const response = await webflowAPI.downloadAssetsCSVBlob(selectedSite, selectedProject.token);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `webflow-assets-${selectedSite}-${selectedProject.name}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      let msg = 'Failed to download CSV';
      if (err.response && err.response.data) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result as string);
              setError(json.message || msg);
            } catch {
              setError(msg);
            }
          };
          reader.readAsText(err.response.data);
          return;
        } catch {}
      }
      setError(msg);
    }
  };

  const renderUploadModal = () => {
    if (!uploadModal.isOpen) return null;
    return (
      <ModalOverlay onClick={closeUploadModal}>
        <UploadModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              Upload New Asset{bulkUploadFiles.length > 1 ? 's' : ''}
            </ModalTitle>
            <CloseButton onClick={closeUploadModal} disabled={uploadModal.isUploading}>×</CloseButton>
          </ModalHeader>
          <UploadModalBody>
            {uploadModal.error && (
              <ErrorMessage>{uploadModal.error}</ErrorMessage>
            )}
            {uploadModal.success ? (
              <SuccessMessage>
                <SuccessIcon>✓</SuccessIcon>
                {bulkUploadFiles.length > 1 ? 'Assets uploaded successfully!' : 'Asset uploaded successfully!'}
              </SuccessMessage>
            ) : (
              <>
                <FormGroup>
                  <Label>Files</Label>
                  <FileInputWrapper>
                    <FileInput
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploadModal.isUploading}
                    />
                    <FileInputLabel>
                      {bulkUploadFiles.length > 0
                        ? `${bulkUploadFiles.length} file${bulkUploadFiles.length > 1 ? 's' : ''} selected`
                        : 'Choose Files...'}
                    </FileInputLabel>
                  </FileInputWrapper>
                  <FileTypeHelp>
                    Supports images, documents, audio, video files (max 50MB each)
                  </FileTypeHelp>
                </FormGroup>
                {bulkUploadFiles.length > 0 && (
                  <FileListContainer>
                    {bulkUploadFiles.map((f, idx) => (
                      <FileListItem key={idx}>
                        <span className="file-name">{f.file.name}</span>
                        <Input
                          type="text"
                          placeholder="Alt Text (optional)"
                          value={f.altText}
                          onChange={e => handleBulkAltTextChange(idx, e.target.value)}
                          style={{ width: 180, minWidth: 120 }}
                          disabled={uploadModal.isUploading}
                        />
                        {f.success && <span className="success">✓</span>}
                        {f.error && <span className="error" title={f.error}>!</span>}
                        {uploadModal.isUploading && (
                          <span className="progress">
                            {f.progress > 0 && f.progress < 100 ? `${f.progress}%` : ''}
                          </span>
                        )}
                      </FileListItem>
                    ))}
                  </FileListContainer>
                )}
                <UploadModalFooter>
                  <Button onClick={closeUploadModal} disabled={uploadModal.isUploading}>
                    Cancel
                  </Button>
                  <Button
                    primary
                    onClick={handleBulkUpload}
                    disabled={uploadModal.isUploading || bulkUploadFiles.length === 0 || bulkUploadFiles.every(f => f.success)}
                  >
                    {uploadModal.isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </UploadModalFooter>
              </>
            )}
          </UploadModalBody>
        </UploadModalContent>
      </ModalOverlay>
    );
  };

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

  const handleInlineEditAlt = (asset: WebflowAsset, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening the asset modal
    setInlineEditingAssetId(asset.id);
    setInlineAltTextInput(asset.altText || '');
    setInlineAltTextError('');
  };

  const handleInlineSaveAltText = async (asset: WebflowAsset, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening the asset modal
    setInlineAltTextLoading(true);
    setInlineAltTextError('');
    
    try {
      await webflowAPI.updateAssetAltText(
        asset.id, 
        inlineAltTextInput.trim(),
        selectedProject?.token,
        asset.name
      );
      
      // Log the activity
      if (selectedProject?.id) {
        await recordActivity(
          selectedProject.id,
          'update_alt_text',
          'asset',
          asset.id,
          { altText: asset.altText },
          { altText: inlineAltTextInput.trim() }
        );
      }
      
      // Update asset in state
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, altText: inlineAltTextInput.trim() } : a));
      setFilteredAssets(prev => prev.map(a => a.id === asset.id ? { ...a, altText: inlineAltTextInput.trim() } : a));
      setInlineEditingAssetId(null);
    } catch (err: any) {
      setInlineAltTextError(err?.response?.data?.message || 'Failed to update alt text');
    } finally {
      setInlineAltTextLoading(false);
    }
  };

  const handleInlineCancelEditAlt = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening the asset modal
    setInlineEditingAssetId(null);
    setInlineAltTextError('');
  };

  if (!user) return null;
  if (projects.length === 0) {
    return <div>Please add a project to access this section.</div>;
  }
  if (!selectedProject) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)', fontWeight: 600 }}>Please select a project to continue.</div>;
  }

  return (
    <PageContainer>
      <EditButtonHoverStyle />
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

      {/* Enhanced Header Section */}
      <ModernPageHeader>
        <HeaderContent>
          <HeaderTitleSection>
            <PageTitleIcon>🎨</PageTitleIcon>
            <div>
              <ModernPageTitle>Asset Library</ModernPageTitle>
              <ModernPageDescription>
                Manage and organize your Webflow assets with powerful tools
              </ModernPageDescription>
            </div>
          </HeaderTitleSection>
          <HeaderActions>
            <SearchContainer>
              <SearchIcon>🔍</SearchIcon>
              <SearchInput
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <ClearButton onClick={() => setSearchTerm('')}>×</ClearButton>
              )}
            </SearchContainer>
            <ModernRefreshButton 
              onClick={() => selectedSite && fetchAssets(selectedSite)} 
              disabled={projectsLoading || !selectedSite}
            >
              {projectsLoading ? <LoadingSpinner size="small" /> : <RefreshIcon>↻</RefreshIcon>}
              Refresh
            </ModernRefreshButton>
          </HeaderActions>
        </HeaderContent>
      </ModernPageHeader>

      {projectsLoading ? (
        <LoadingSection>
          <LoadingSpinner size="large" />
          <LoadingMessage>Loading your assets...</LoadingMessage>
        </LoadingSection>
      ) : error ? (
        <ErrorSection>
          <ErrorIcon>⚠️</ErrorIcon>
          <ErrorMessage>{error}</ErrorMessage>
        </ErrorSection>
      ) : !selectedSite ? (
        <EmptySection>
          <EmptyIcon>🏗️</EmptyIcon>
          <EmptyTitle>No Site Selected</EmptyTitle>
          <EmptyDescription>Please select a site to view its assets</EmptyDescription>
        </EmptySection>
      ) : assets.length === 0 ? (
        <EmptySection>
          <EmptyIcon>📁</EmptyIcon>
          <EmptyTitle>No Assets Found</EmptyTitle>
          <EmptyDescription>
            This site doesn't have any assets yet. Upload your first asset to get started!
          </EmptyDescription>
          <EmptyAction>
            <ModernButton primary onClick={openUploadModal}>
              <ButtonIcon>+</ButtonIcon> Upload First Asset
            </ModernButton>
          </EmptyAction>
        </EmptySection>
      ) : filteredAssets.length === 0 ? (
        Object.values(typeFilters).every(value => !value) ? (
          <EmptySection>
            <EmptyIcon>🔍</EmptyIcon>
            <EmptyTitle>No Filters Selected</EmptyTitle>
            <EmptyDescription>Please select at least one file type filter to view assets</EmptyDescription>
          </EmptySection>
        ) : searchTerm ? (
          <EmptySection>
            <EmptyIcon>🔍</EmptyIcon>
            <EmptyTitle>No Results Found</EmptyTitle>
            <EmptyDescription>No assets found matching "{searchTerm}"</EmptyDescription>
            <EmptyAction>
              <ModernButton onClick={() => setSearchTerm('')}>
                Clear Search
              </ModernButton>
            </EmptyAction>
          </EmptySection>
        ) : (
          <EmptySection>
            <EmptyIcon>🔍</EmptyIcon>
            <EmptyTitle>No Matches</EmptyTitle>
            <EmptyDescription>No assets match the current filters</EmptyDescription>
          </EmptySection>
        )
      ) : (
        <>
          {/* Stats Overview */}
          <StatsSection>
            <StatCard>
              <StatIcon $color="var(--primary-color)">📊</StatIcon>
              <StatValue>{assets.length}</StatValue>
              <StatLabel>Total Assets</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon $color="#10b981">🖼️</StatIcon>
              <StatValue>{assets.filter(a => a.isImage).length}</StatValue>
              <StatLabel>Images</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon $color="#f59e0b">📄</StatIcon>
              <StatValue>{assets.filter(a => !a.isImage).length}</StatValue>
              <StatLabel>Documents</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon $color="#6366f1">💾</StatIcon>
              <StatValue>{formatFileSize(assets.reduce((sum, a) => sum + a.fileSize, 0))}</StatValue>
              <StatLabel>Total Size</StatLabel>
            </StatCard>
          </StatsSection>

          {/* Action Bar */}
          <ModernActionBar>
            <ActionGroup>
              <ModernButton primary onClick={openUploadModal}>
                <ButtonIcon>+</ButtonIcon> Upload Asset
              </ModernButton>
              <ModernButton onClick={downloadCSV}>
                <ButtonIcon>⬇️</ButtonIcon> Export CSV
              </ModernButton>
            </ActionGroup>
            
            <GridSizeControls>
              <GridSizeLabel>View:</GridSizeLabel>
              <GridSizeOptions>
                <GridSizeButton $active={gridSize === 'small'} onClick={() => setGridSize('small')} title="Small thumbnails">
                  <span>⊞</span>
                </GridSizeButton>
                <GridSizeButton $active={gridSize === 'medium'} onClick={() => setGridSize('medium')} title="Medium thumbnails">
                  <span>⊡</span>
                </GridSizeButton>
                <GridSizeButton $active={gridSize === 'large'} onClick={() => setGridSize('large')} title="Large thumbnails">
                  <span>⬜</span>
                </GridSizeButton>
              </GridSizeOptions>
            </GridSizeControls>
            
            <AssetCountBadge>
              {filteredAssets.length === assets.length
                ? `${assets.length} assets`
                : `${filteredAssets.length} of ${assets.length} assets`}
            </AssetCountBadge>
          </ModernActionBar>
          
          {/* Compact Filter Section */}
          <CompactFilterContainer>
            <FilterRow>
              <FilterGroup>
                <FilterGroupTitle>Type:</FilterGroupTitle>
                <CompactFilterOptions>
                  {['image', 'svg', 'document', 'video', 'audio', 'other'].map(type => 
                    availableTypes.includes(type) && (
                      <CompactFilterChip key={type} $active={typeFilters[type]} onClick={() => handleTypeFilterChange(type)}>
                        <span>
                          {type === 'image' && '🖼️'}
                          {type === 'svg' && '📊'}
                          {type === 'document' && '📄'}
                          {type === 'video' && '🎬'}
                          {type === 'audio' && '🎵'}
                          {type === 'other' && '📦'}
                        </span>
                        {type === 'image' && 'Images'}
                        {type === 'svg' && 'SVG'}
                        {type === 'document' && 'Docs'}
                        {type === 'video' && 'Video'}
                        {type === 'audio' && 'Audio'}
                        {type === 'other' && 'Other'}
                        <CompactFilterCount>
                          {assets.filter(asset => {
                            const mimeType = asset.mimeType.toLowerCase();
                            if (type === 'svg') return mimeType.startsWith('image/svg');
                            if (type === 'image') return mimeType.startsWith('image/') && !mimeType.includes('svg');
                            if (type === 'document') return mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/');
                            if (type === 'video') return mimeType.startsWith('video/');
                            if (type === 'audio') return mimeType.startsWith('audio/');
                            return true; // 'other'
                          }).length}
                        </CompactFilterCount>
                      </CompactFilterChip>
                  ))}
                </CompactFilterOptions>
              </FilterGroup>
              
              <FilterGroup>
                <FilterGroupTitle>Alt Text:</FilterGroupTitle>
                <CompactFilterOptions>
                  <CompactFilterChip $active={altTextFilter === 'all'} onClick={() => setAltTextFilter('all')}>
                    <span>📝</span>
                    All
                    <CompactFilterCount>{assets.length}</CompactFilterCount>
                  </CompactFilterChip>
                  <CompactFilterChip $active={altTextFilter === 'with-alt'} onClick={() => setAltTextFilter('with-alt')}>
                    <span>✅</span>
                    With Alt
                    <CompactFilterCount>{assets.filter(asset => asset.altText && asset.altText.trim().length > 0).length}</CompactFilterCount>
                  </CompactFilterChip>
                  <CompactFilterChip $active={altTextFilter === 'without-alt'} onClick={() => setAltTextFilter('without-alt')}>
                    <span>❌</span>
                    Missing Alt
                    <CompactFilterCount>{assets.filter(asset => !asset.altText || asset.altText.trim().length === 0).length}</CompactFilterCount>
                  </CompactFilterChip>
                </CompactFilterOptions>
              </FilterGroup>
              
              <FilterActions>
                <FilterActionButton onClick={selectAllFilters}>Select All</FilterActionButton>
                <FilterActionButton onClick={deselectAllFilters}>Reset Filters</FilterActionButton>
              </FilterActions>
            </FilterRow>
          </CompactFilterContainer>
          
          {/* Enhanced Assets Grid */}
          <ModernAssetsGrid $gridSize={gridSize}>
            {filteredAssets.map(asset => (
              <ModernAssetCard key={asset.id} onClick={() => openAssetModal(asset)}>
                <AssetCardHeader>
                                     <AssetTypeIndicator $isImage={!!asset.isImage}>
                     {getAssetTypeIcon(asset.mimeType)}
                   </AssetTypeIndicator>
                  {asset.isImage && asset.dimensions && (
                    <AssetDimensions>
                      {asset.dimensions.width}×{asset.dimensions.height}
                    </AssetDimensions>
                  )}
                </AssetCardHeader>

                {asset.isImage ? (
                  <ModernAssetThumbnail>
                    <img src={asset.thumbnailUrl || asset.url} alt={asset.altText || asset.name} />
                    <ThumbnailOverlay>
                      <PreviewIcon>👁️</PreviewIcon>
                    </ThumbnailOverlay>
                  </ModernAssetThumbnail>
                ) : (
                  <ModernAssetIconContainer>
                    <ModernTypeIcon>{getAssetTypeIcon(asset.mimeType)}</ModernTypeIcon>
                    <FileExtension>
                      {asset.fileName.split('.').pop()?.toUpperCase()}
                    </FileExtension>
                  </ModernAssetIconContainer>
                )}

                <ModernAssetInfo>
                  <AssetMainInfo>
                    <ModernAssetName title={asset.name}>{asset.name}</ModernAssetName>
                    <ModernAssetFileName title={asset.fileName}>{asset.fileName}</ModernAssetFileName>
                  </AssetMainInfo>

                  <AssetAltTextSection>
                    {inlineEditingAssetId === asset.id ? (
                      <InlineEditContainer>
                        <InlineAltTextInput
                          type="text"
                          value={inlineAltTextInput}
                          onChange={e => setInlineAltTextInput(e.target.value)}
                          disabled={inlineAltTextLoading}
                          maxLength={255}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                          placeholder="Enter alt text..."
                        />
                        <InlineButtonGroup>
                          <InlineActionButton 
                            primary 
                            onClick={e => handleInlineSaveAltText(asset, e)} 
                            disabled={inlineAltTextLoading || inlineAltTextInput.trim() === (asset.altText || '').trim()}
                          >
                            {inlineAltTextLoading ? '💾' : '✓'}
                          </InlineActionButton>
                          <InlineActionButton onClick={handleInlineCancelEditAlt} disabled={inlineAltTextLoading}>
                            ✕
                          </InlineActionButton>
                        </InlineButtonGroup>
                        {inlineAltTextError && <InlineAltTextError>{inlineAltTextError}</InlineAltTextError>}
                      </InlineEditContainer>
                    ) : (
                      <AltTextDisplay>
                        <AltTextLabel>Alt:</AltTextLabel>
                        <ModernAssetAltText title={getDisplayAltText(asset.altText) || "No alt text"}>
                          {getDisplayAltText(asset.altText) || <EmptyAltText>Not set</EmptyAltText>}
                        </ModernAssetAltText>
                        {asset.isImage && (
                          <ModernEditAltButton onClick={e => handleInlineEditAlt(asset, e)}>
                            ✏️
                          </ModernEditAltButton>
                        )}
                      </AltTextDisplay>
                    )}
                  </AssetAltTextSection>

                  <ModernAssetMeta>
                    <MetaItem>
                      <MetaIcon>💾</MetaIcon>
                      <MetaText>{formatFileSize(asset.fileSize)}</MetaText>
                    </MetaItem>
                    <MetaItem>
                      <MetaIcon>📅</MetaIcon>
                      <MetaText>{formatDate(asset.lastUpdated)}</MetaText>
                    </MetaItem>
                  </ModernAssetMeta>
                </ModernAssetInfo>
              </ModernAssetCard>
            ))}
          </ModernAssetsGrid>
        </>
      )}
      
      {modal.isOpen && renderAssetModal()}
      {renderUploadModal()}
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

const SiteSelector = styled.select`
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-light);
  color: var(--text-primary);
  min-width: 200px;
  font-size: 0.875rem;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;

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

const InfoMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
`;

const NoDataMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
`;

const AssetCount = styled.div`
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: var(--text-tertiary);
`;

const AssetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const AssetCard = styled.div`
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  overflow: hidden;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  cursor: pointer;
  position: relative;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const AssetThumbnail = styled.div`
  height: 140px;
  background-color: var(--secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AssetIconContainer = styled.div`
  height: 140px;
  background-color: var(--secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TypeIcon = styled.div`
  font-size: 3rem;
  color: var(--text-secondary);
`;

const AssetInfo = styled.div`
  padding: 1rem;
`;

const AssetName = styled.h3`
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AssetFileName = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AssetAltText = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyAltText = styled.span`
  color: var(--error-color);
  opacity: 0.7;
`;

const AssetMeta = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-tertiary);
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
  box-shadow: var(--box-shadow);
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease-out;
  overflow: hidden;
  box-sizing: border-box;
  
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
  overflow-x: hidden;
  box-sizing: border-box;
  width: 100%;
`;

const ModalFooter = styled.div`
  padding: 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
  box-sizing: border-box;
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

const AssetPreview = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--secondary-color);
  border-radius: var(--border-radius);
`;

const AssetImage = styled.img`
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
`;

const AssetIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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

const AssetUrl = styled.a`
  color: var(--primary-color);
  text-decoration: none;
  word-break: break-all;
  
  &:hover {
    text-decoration: underline;
  }
  
  span {
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }
`;

// Loading Spinner component
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

const FilterContainer = styled.div`
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`;

const FilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const FilterLabel = styled.div`
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

const FilterActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
`;

const FilterActionButton = styled.button`
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

const FilterButton = styled.button`
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background-color: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

const FilterOptionsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const FilterOption = styled.div`
  display: flex;
  align-items: center;
`;

const FilterCheckbox = styled.input`
  margin-right: 0.5rem;
  cursor: pointer;
`;

const FilterCheckboxLabel = styled.label`
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  
  &:hover {
    color: var(--primary-color);
  }
`;

const ImageAltText = styled.div`
  margin-top: 0.75rem;
  padding: 0.5rem;
  background-color: var(--background-main);
  border-radius: var(--border-radius);
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const AltTextLabel = styled.span`
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-secondary);
`;

const AltTextValue = styled.span`
  font-size: 0.75rem;
  color: var(--text-primary);
  font-style: italic;
`;

const AltTextMissing = styled.span`
  font-size: 0.75rem;
  color: var(--error-color);
  font-style: italic;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const ButtonIcon = styled.span`
  margin-right: 0.5rem;
`;

const FileInputWrapper = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: 0.5rem;
`;

const FileInput = styled.input`
  opacity: 0;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  z-index: 2;
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const FileInputLabel = styled.div`
  padding: 0.75rem 1rem;
  background-color: var(--background-main);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--primary-color);
  }
`;

const FileTypeHelp = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-light);
  color: var(--text-primary);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  &:disabled {
    background-color: var(--secondary-color);
    cursor: not-allowed;
  }
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 20px;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  margin: 1rem 0;
  overflow: hidden;
  position: relative;
`;

const ProgressBar = styled.div`
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-primary);
`;

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  margin: 1rem 0;
  background-color: var(--success-color);
  opacity: 0.1;
  border-radius: var(--border-radius);
  color: var(--success-color);
  font-weight: 500;
`;

const SuccessIcon = styled.span`
  margin-right: 0.5rem;
  font-size: 1.5rem;
  color: var(--success-color);
`;

// Custom styled components specific for upload modal
const UploadModalContent = styled.div`
  background-color: var(--background-light);
  border-radius: 12px;
  box-shadow: var(--box-shadow);
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease-out;
  overflow: hidden;
`;

const UploadModalBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
`;

const UploadModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  width: 100%;
`;

const FileListContainer = styled.div`
  max-height: 250px;
  overflow-y: auto;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
`;

const FileListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  background: var(--background-main);
  border-radius: 4px;
  padding: 10px;
  border: 1px solid var(--border-color);
  width: 100%;
  box-sizing: border-box;
  
  .file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }
  
  .success {
    color: var(--success-color);
    font-weight: 600;
  }
  
  .error {
    color: var(--error-color);
    font-weight: 600;
  }
  
  .progress {
    width: 60px;
    color: var(--text-secondary);
  }
`;

const AssetAltTextContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  position: relative;
  min-height: 26px;
`;

const EditAltButton = styled.button`
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 0 8px;
  font-size: 0.7rem;
  cursor: pointer;
  color: var(--text-secondary);
  height: 20px;
  display: none;
  margin-left: 4px;
  
  &:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

const InlineAltTextInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.8rem;
  min-width: 0;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;

const InlineActionButton = styled.button<{ primary?: boolean }>`
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;
  
  ${props => props.primary ? `
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    
    &:hover:not(:disabled) {
      background-color: var(--primary-dark);
    }
  ` : `
    background-color: transparent;
    color: var(--text-secondary);
    
    &:hover:not(:disabled) {
      background-color: var(--hover-color);
      color: var(--primary-color);
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const InlineAltTextError = styled.div`
  color: var(--error-color);
  font-size: 0.7rem;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Style for showing edit button on hover
const EditButtonHoverStyle = createGlobalStyle`
  ${AssetCard}:hover ${EditAltButton} {
    display: block;
  }
`;

// Modern styled components for Assets UI
const ModernPageHeader = styled.div`
  background: linear-gradient(135deg, var(--background-light) 0%, var(--background-secondary) 100%);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
`;

const HeaderTitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const PageTitleIcon = styled.div`
  font-size: 3rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
`;

const ModernPageTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  line-height: 1.2;
`;

const ModernPageDescription = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
  opacity: 0.9;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ModernRefreshButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: var(--primary-color);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: var(--hover-color);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  ${props => props.disabled && `
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      background: var(--primary-color);
      transform: none;
      box-shadow: none;
    }
  `}
`;

const StatsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: var(--background-light);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const StatIcon = styled.div<{ $color: string }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  margin-bottom: 1rem;
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
`;

const ModernActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 1.5rem;
  background: var(--background-light);
  border-radius: 12px;
  border: 1px solid var(--border-color);
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 1rem;
`;

const ModernButton = styled.button<{ primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.primary ? `
    background: var(--primary-color);
    color: white;
    border: none;
    
    &:hover {
      background: var(--hover-color);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  ` : `
    background: var(--background-main);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    
    &:hover {
      background: var(--hover-color);
      border-color: var(--primary-color);
    }
  `}
`;

const AssetCountBadge = styled.div`
  background: var(--secondary-color);
  color: var(--primary-color);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
`;

const GridSizeControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const GridSizeLabel = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

const GridSizeOptions = styled.div`
  display: flex;
  gap: 0.25rem;
  background: var(--background-main);
  border-radius: 6px;
  padding: 0.25rem;
  border: 1px solid var(--border-color);
`;

const GridSizeButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: none;
  background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'var(--text-secondary)'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$active ? 'var(--hover-color)' : 'var(--background-secondary)'};
  }
  
  span {
    font-size: 1rem;
  }
`;

// Compact Filter Components
const CompactFilterContainer = styled.div`
  background: var(--background-light);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border-color);
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FilterGroupTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: fit-content;
`;

const CompactFilterOptions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const CompactFilterChip = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 20px;
  border: 1px solid ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
  background: ${props => props.$active ? 'var(--primary-color)' : 'var(--background-main)'};
  color: ${props => props.$active ? 'white' : 'var(--text-primary)'};
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: var(--primary-color);
    background: ${props => props.$active ? 'var(--hover-color)' : 'var(--primary-color-light, #e6f3ff)'};
    transform: translateY(-1px);
  }
  
  span {
    font-size: 0.875rem;
  }
`;

const CompactFilterCount = styled.span`
  background: var(--background-secondary);
  color: inherit;
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  font-size: 0.625rem;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
`;

const ModernAssetsGrid = styled.div<{ $gridSize: 'small' | 'medium' | 'large' }>`
  display: grid;
  grid-template-columns: ${props => {
    switch (props.$gridSize) {
      case 'small':
        return 'repeat(auto-fill, minmax(200px, 1fr))';
      case 'medium':
        return 'repeat(auto-fill, minmax(280px, 1fr))';
      case 'large':
        return 'repeat(auto-fill, minmax(360px, 1fr))';
      default:
        return 'repeat(auto-fill, minmax(280px, 1fr))';
    }
  }};
  gap: ${props => {
    switch (props.$gridSize) {
      case 'small':
        return '1rem';
      case 'medium':
        return '1.5rem';
      case 'large':
        return '2rem';
      default:
        return '1.5rem';
    }
  }};
  margin-bottom: 2rem;
`;

const ModernAssetCard = styled.div`
  background: var(--background-light);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    border-color: var(--primary-color);
  }
`;

const AssetCardHeader = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 2;
`;

const AssetTypeIndicator = styled.div<{ $isImage: boolean }>`
  background: ${props => props.$isImage ? 'rgba(0, 0, 0, 0.6)' : 'var(--primary-color)'};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
`;

const AssetDimensions = styled.div`
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
`;

const ModernAssetThumbnail = styled.div`
  height: 180px;
  background: var(--secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ThumbnailOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${ModernAssetCard}:hover & {
    opacity: 1;
  }
`;

const PreviewIcon = styled.div`
  color: white;
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
`;

const ModernAssetIconContainer = styled.div`
  height: 180px;
  background: var(--secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const ModernTypeIcon = styled.div`
  font-size: 4rem;
  color: var(--text-secondary);
`;

const FileExtension = styled.div`
  background: var(--primary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
`;

const ModernAssetInfo = styled.div`
  padding: 1.25rem;
`;

const AssetMainInfo = styled.div`
  margin-bottom: 1rem;
`;

const ModernAssetName = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ModernAssetFileName = styled.div`
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', monospace;
  background: var(--background-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const AssetAltTextSection = styled.div`
  margin-bottom: 1rem;
`;

const InlineEditContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
`;

const InlineButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const AltTextDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 24px;
`;

const ModernAssetAltText = styled.div`
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-style: italic;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ModernEditAltButton = styled.button`
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--text-secondary);
  opacity: 0;
  transition: all 0.2s;
  
  ${ModernAssetCard}:hover & {
    opacity: 1;
  }
  
  &:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

const ModernAssetMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const MetaIcon = styled.span`
  font-size: 0.75rem;
`;

const MetaText = styled.span`
  font-size: 0.75rem;
  color: var(--text-tertiary);
`;

const LoadingSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
`;

const ErrorSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
`;

const ErrorIcon = styled.div`
  font-size: 3rem;
`;

const EmptySection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: var(--background-light);
  border-radius: 12px;
  border: 2px dashed var(--border-color);
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.6;
`;

const EmptyTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
`;

const EmptyDescription = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0 0 2rem 0;
  max-width: 400px;
`;

const EmptyAction = styled.div`
  display: flex;
  gap: 1rem;
`;

export default Assets;