import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { webflowAPI } from '../api/apiClient';
import axios from 'axios';
import SparkMD5 from 'spark-md5';
import { Project } from './Dashboard';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useProjectContext } from '../contexts/ProjectContext';

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
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [editingAltText, setEditingAltText] = useState(false);
  const [altTextInput, setAltTextInput] = useState('');
  const [altTextLoading, setAltTextLoading] = useState(false);
  const [altTextError, setAltTextError] = useState('');
  const [bulkUploadFiles, setBulkUploadFiles] = useState<BulkUploadFile[]>([]);

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

  // Filter assets when search term, assets, or type filters change
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
  }, [assets, searchTerm, sortConfig, typeFilters]);

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
    setTypeFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const selectAllFilters = () => {
    const allEnabled = Object.fromEntries(
      Object.keys(typeFilters).map(key => [key, true])
    );
    setTypeFilters(allEnabled);
  };

  const deselectAllFilters = () => {
    const allDisabled = Object.fromEntries(
      Object.keys(typeFilters).map(key => [key, false])
    );
    setTypeFilters(allDisabled);
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
        if (f.altText && assetId) {
          await webflowAPI.updateAssetAltText(
            assetId, 
            f.altText, 
            selectedProject.token,
            f.file.name
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

  if (!user) return null;
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
      <PageHeader>
        <div>
          <PageTitle>Asset Library</PageTitle>
          <PageDescription>
            Browse and manage assets from your Webflow site
          </PageDescription>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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
          <RefreshButton 
            onClick={() => selectedSite && fetchAssets(selectedSite)} 
            disabled={projectsLoading || !selectedSite}
          >
            {projectsLoading ? <LoadingSpinner size="small" /> : <RefreshIcon>↻</RefreshIcon>}
            Refresh
          </RefreshButton>
        </div>
      </PageHeader>

      {projectsLoading ? (
        <LoadingMessage>Loading assets...</LoadingMessage>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : !selectedSite ? (
        <InfoMessage>Please select a site to view its assets</InfoMessage>
      ) : assets.length === 0 ? (
        <NoDataMessage>No assets found in this site.</NoDataMessage>
      ) : filteredAssets.length === 0 ? (
        Object.values(typeFilters).every(value => !value) ? (
          <NoDataMessage>Please select at least one file type filter to view assets.</NoDataMessage>
        ) : searchTerm ? (
          <NoDataMessage>No assets found matching "{searchTerm}".</NoDataMessage>
        ) : (
          <NoDataMessage>No assets match the current filters.</NoDataMessage>
        )
      ) : (
        <>
          <ActionBar>
            <Button primary onClick={openUploadModal}>
              <ButtonIcon>+</ButtonIcon> Upload New Asset
            </Button>
            <Button onClick={downloadCSV}>
              <ButtonIcon>⬇️</ButtonIcon> Download CSV
            </Button>
          </ActionBar>
          
          <FilterContainer>
            <FilterHeader>
              <FilterLabel>Filter by type:</FilterLabel>
              <FilterActions>
                <FilterButton onClick={selectAllFilters}>Select All</FilterButton>
                <FilterButton onClick={deselectAllFilters}>Deselect All</FilterButton>
              </FilterActions>
            </FilterHeader>
            <FilterOptionsContainer>
              {['image', 'svg', 'document', 'video', 'audio', 'other'].map(type => 
                availableTypes.includes(type) && (
                <FilterOption key={type}>
                  <FilterCheckbox 
                    type="checkbox" 
                    id={`filter-${type}`}
                    checked={typeFilters[type]}
                    onChange={() => handleTypeFilterChange(type)}
                  />
                  <FilterCheckboxLabel htmlFor={`filter-${type}`}>
                    {type === 'image' && '🖼️ Images'}
                    {type === 'svg' && '📊 SVG'}
                    {type === 'document' && '📄 Documents'}
                    {type === 'video' && '🎬 Videos'}
                    {type === 'audio' && '🎵 Audio'}
                    {type === 'other' && '📦 Other'}
                  </FilterCheckboxLabel>
                </FilterOption>
              ))}
            </FilterOptionsContainer>
          </FilterContainer>
          
          <AssetCount>
            {filteredAssets.length === assets.length
              ? `${assets.length} assets found`
              : `${filteredAssets.length} of ${assets.length} assets found`}
          </AssetCount>
          
          <AssetsGrid>
            {filteredAssets.map(asset => (
              console.log('Asset card altText:', asset.altText),
              <AssetCard key={asset.id} onClick={() => openAssetModal(asset)}>
                {asset.isImage ? (
                  <AssetThumbnail>
                    <img src={asset.thumbnailUrl || asset.url} alt={asset.altText || asset.name} />
                  </AssetThumbnail>
                ) : (
                  <AssetIconContainer>
                    <TypeIcon>{getAssetTypeIcon(asset.mimeType)}</TypeIcon>
                  </AssetIconContainer>
                )}
                <AssetInfo>
                  <AssetName title={asset.name}>{asset.name}</AssetName>
                  <AssetFileName title={asset.fileName}>{asset.fileName}</AssetFileName>
                  <AssetAltText title={getDisplayAltText(asset.altText) || "No alt text"}>
                    Alt: {getDisplayAltText(asset.altText) || <EmptyAltText>Not set</EmptyAltText>}
                  </AssetAltText>
                  <AssetMeta>
                    <span>{formatFileSize(asset.fileSize)}</span>
                    <span>{formatDate(asset.lastUpdated)}</span>
                  </AssetMeta>
                </AssetInfo>
              </AssetCard>
            ))}
          </AssetsGrid>
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
    color: var(--primary-color);
    border-color: var(--primary-color);
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

export default Assets; 