import React, { useState, useEffect, useRef, ReactElement } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useProjectContext } from '../contexts/ProjectContext';
import { FiCheck, FiX } from 'react-icons/fi';
import { webflowAPI } from '../api/apiClient';
import { Project } from './Dashboard';
import { supabase } from '../lib/supabaseClient';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiRefreshCw } from 'react-icons/fi';
import {
  WebflowCollection,
  WebflowCollectionItem,
  ModalState,
  EditModalState,
  ItemDetailModalState,
  DropdownState,
  ItemCountsProps,
  ItemCountBadgeProps,
  ItemCountLabelProps,
  ColumnToggleButtonProps
} from '../types/webflow';
import {
  ActionButton as ImportedActionButton,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  CloseButton as ImportedCloseButton,
  ModalBody,
  ModalFooter,
  ItemsTableWrapper as ImportedItemsTableWrapper,
  ItemsTable as ImportedItemsTable,
  ItemsTableHeader as ImportedItemsTableHeader,
  ItemsTableRow as ImportedItemsTableRow,
  ItemsTableCell as ImportedItemsTableCell,
  ColumnToggleButton as ImportedColumnToggleButton,
  CheckIcon as ImportedCheckIcon,
  EditModalContent as ImportedEditModalContent,
  EditModalHeader as ImportedEditModalHeader,
  EditModalTitle as ImportedEditModalTitle,
  EditModalSubtitle as ImportedEditModalSubtitle,
  EditModalBody as ImportedEditModalBody,
  EditModalFooter as ImportedEditModalFooter
} from '../components/ui/WebflowStyledComponents';
// Add import for react-quill
// import ReactQuill from 'react-quill';
// import 'react-quill/dist/quill.snow.css';
// Add the new import for activity logging
import { recordActivity } from '../services/activityLogService';

// Add these styled components at the top, before the CMSEditor component
const CmsEditorContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

const CmsHeader = styled.div`
  margin-bottom: 2rem;
  
  h1 {
    font-size: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  
  p {
    color: var(--text-secondary);
    font-size: 1rem;
  }
`;

const FiltersContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  align-items: center;
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

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  background-color: rgba(229, 62, 62, 0.1);
  border-radius: var(--border-radius);
  padding: 1rem;
  margin-bottom: 1.5rem;
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

const CollectionsCount = styled.div`
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
  
  th {
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
  }
  
  td {
    padding: 1rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background-color: var(--hover-color);
  }
`;

const ItemCounts = styled.span`
  margin-left: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 0.75rem;
  background-color: var(--background-main);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--primary-color);
  }
  
  &.details-button {
    color: var(--info-color);
    border-color: var(--info-color);
    background-color: rgba(66, 153, 225, 0.1);
    
    &:hover {
      background-color: rgba(66, 153, 225, 0.2);
    }
  }
  
  &.edit-button {
    color: var(--primary-color);
    border-color: var(--primary-color);
    background-color: rgba(49, 130, 206, 0.1);
    
    &:hover {
      background-color: rgba(49, 130, 206, 0.2);
    }
  }
  
  &.small-button {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background-color: var(--background-main);
    }
  }
`;

// Create a component for editable fields list
const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: var(--background-main);
  padding: 0.75rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  margin-top: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
`;

// Create a component for editable field item
const FieldItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// Create a component for editable field name
const FieldName = styled.span`
  font-weight: 600;
  color: var(--text-primary);
`;

// Create a component for editable field type
const FieldType = styled.span`
  margin-left: 1rem;
  color: var(--text-secondary);
`;

// Create a component for editable field slug
const FieldSlug = styled.span`
  font-size: 0.8rem;
  color: var(--text-secondary);
`;

// Create a component for editable required badge
const RequiredBadge = styled.span`
  background-color: rgba(229, 62, 62, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--error-color);
`;

// Create a component for editable edit modal content
const EditModalContent = styled.div`
  background-color: var(--background-main);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 1240px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
`;

// Create a component for editable edit modal header
const EditModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background-color: var(--background-light);
  border-bottom: 1px solid var(--border-color);
`;

// Create a component for editable edit modal title
const EditModalTitle = styled.div`
  display: flex;
  flex-direction: column;
  
  span {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
`;

// Create a component for editable edit modal subtitle
const EditModalSubtitle = styled.div`
  font-size: 0.9rem;
  color: var(--text-secondary);
`;

// Create a component for editable edit modal body
const EditModalBody = styled.div`
  padding: 1.5rem 2rem;
  overflow: auto;
  flex: 1;
`;

// Create a component for editable edit modal footer
const EditModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  background-color: var(--background-light);
  border-top: 1px solid var(--border-color);
`;

// Create a component for editable items count
const ItemsCount = styled.div`
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

// Create a component for editable column toggle container
const ColumnToggleContainer = styled.div`
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background-color: var(--background-light);
  border-radius: 8px;
  border: 1px solid var(--border-color);
`;

// Create a component for editable column toggle header
const ColumnToggleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

// Create a component for editable column toggle label
const ColumnToggleLabel = styled.div`
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
`;

// Create a component for editable column actions
const ColumnActions = styled.div`
  display: flex;
  gap: 0.75rem;
`;

// Create a component for editable column toggle buttons
const ColumnToggleButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

// Create a component for editable column toggle button
const ColumnToggleButton = styled.button<ColumnToggleButtonProps>`
  padding: 0.5rem 0.75rem;
  background-color: ${props => props.$active ? 'var(--primary-color)' : 'var(--background-main)'};
  color: ${props => props.$active ? 'white' : 'var(--text-secondary)'};
  border: 1px solid ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  
  &:hover {
    background-color: ${props => props.$active ? 'var(--primary-hover)' : 'var(--hover-color)'};
    border-color: ${props => props.$active ? 'var(--primary-hover)' : 'var(--primary-color)'};
    color: ${props => props.$active ? 'white' : 'var(--primary-color)'};
  }
`;

// Create a component for editable check icon
const CheckIcon = styled.span`
  font-size: 0.8rem;
  font-weight: bold;
`;

// Create a component for editable items table wrapper
const ItemsTableWrapper = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: white;
`;

// Create a component for editable items table container
const ItemsTableContainer = styled.div`
  overflow-x: auto;
  max-height: 50vh;
`;

// Create a component for editable items table
const ItemsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

// Create a component for editable items table header
const ItemsTableHeader = styled.th`
  position: sticky;
  top: 0;
  background-color: var(--secondary-color);
  padding: 0.9rem 1rem;
  text-align: left;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-color);
  z-index: 1;
`;

// Create a component for editable items table row
const ItemsTableRow = styled.tr`
  &:nth-child(even) {
    background-color: var(--background-light);
  }
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

// Create a component for editable items table cell
const ItemsTableCell = styled.td`
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-color);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Create a component for editable empty columns message
const EmptyColumnsMessage = styled.div`
  text-align: center;
  padding: 3rem 0;
  color: var(--text-secondary);
  font-style: italic;
  background-color: var(--background-light);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
`;

// Create a component for editable detail link
const DetailLink = styled.a`
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s;
  
  &:hover {
    color: var(--primary-hover);
  }
`;

// Create a component for rich text display
const RichTextContainer = styled.div`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
`;

// Create a component for editable rich text preview
const RichTextPreview = styled.div`
  white-space: pre-wrap;
  max-height: 250px;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--background-main);
  font-size: 0.9rem;
  line-height: 1.5;
  
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  
  p {
    margin-bottom: 1rem;
  }
  
  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }
`;

// Create a component for editable show raw HTML button
const ShowRawHtmlButton = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.8rem;
  margin-top: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    background-color: rgba(66, 153, 225, 0.1);
    color: var(--primary-hover);
  }
`;

// Create a component for editable raw HTML content
const RawHtmlContent = styled.pre`
  background-color: var(--background-main);
  padding: 1rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  overflow: auto;
  font-size: 0.8rem;
`;

// Create a component for editable expandable text
const ExpandableText = styled.span`
  color: var(--text-secondary);
`;

// Create a component for editable show more button
const ShowMoreButton = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 0.5rem;
  transition: color 0.2s;
  
  &:hover {
    color: var(--primary-hover);
  }
`;

// Create a component for editable array container
const ArrayContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  max-width: 100%;
  background-color: var(--background-main);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
`;

// Create a component for editable array item
const ArrayItem = styled.span`
  background-color: rgba(0, 0, 0, 0.04);
  padding: 0.4rem 0.75rem;
  border-radius: 50px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  color: var(--text-primary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Create a component for editable pre formatted JSON
const PreFormattedJson = styled.pre`
  background-color: var(--background-main);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: auto;
  font-size: 0.85rem;
  line-height: 1.5;
  font-family: monospace;
  max-height: 300px;
`;

// Create a component for editable empty value
const EmptyValue = styled.span`
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
`;

// Create a component for editable item detail grid
const ItemDetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
`;

// Create a component for editable item detail section
const ItemDetailSection = styled.div`
  margin-bottom: 2rem;
`;

// Create a component for editable item detail section title
const ItemDetailSectionTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  display: flex;
  align-items: center;
  
  &::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 1rem;
    background-color: var(--primary-color);
    margin-right: 0.75rem;
    border-radius: 2px;
  }
`;

// Create a component for editable item detail table
const ItemDetailTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--background-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  table-layout: fixed;
`;

// Create a component for editable item detail row
const ItemDetailRow = styled.tr`
  td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    transition: background 0.2s;
    position: relative;
  }
  &:hover td {
    background: var(--hover-color);
  }
  &.editing td {
    background: var(--primary-color-light, #e6f0fa);
    border-left: 4px solid var(--primary-color);
  }
`;

// Create a component for editable item detail label
const ItemDetailLabel = styled.td`
  flex: 1 1 30%;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
  align-items: center;
  display: flex;
  gap: 0.5rem;
`;

// Create a component for editable item detail value
const ItemDetailValue = styled.td`
  flex: 2 1 60%;
  color: var(--text-secondary);
  font-size: 1rem;
  align-items: center;
  display: flex;
  gap: 1rem;
  word-break: break-word;
`;

// Create a component for editable item status badge
const ItemStatusBadge = styled.span<{ $status: string }>`
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background-color: ${props => 
    props.$status === 'published' ? 'rgba(72, 187, 120, 0.1)' :
    props.$status === 'draft' ? 'rgba(237, 137, 54, 0.1)' :
    'rgba(66, 153, 225, 0.1)'
  };
  color: ${props => 
    props.$status === 'published' ? 'var(--success-color)' :
    props.$status === 'draft' ? 'var(--warning-color)' :
    'var(--info-color)'
  };
`;

// Create a component for editable image field container
const ImageFieldContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.2rem 0;
  background: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
`;

const ImageThumbnail = styled.img`
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  border: 2.5px solid #f3f4f6;
  background: #fff;
  transition: box-shadow 0.18s, transform 0.18s;
  &:hover {
    box-shadow: 0 4px 16px rgba(99,102,241,0.13);
    transform: scale(1.04);
  }
`;

const ImageDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #444;
  font-size: 1.02rem;
  font-weight: 500;
  letter-spacing: 0.01em;
`;

// Create a component for editable item detail modal content
const ItemDetailModalContent = styled(ModalContent)`
  width: 95%;
  max-width: 1000px;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color);
  overflow: hidden;
`;

// Create a component for editable item detail modal header
const ItemDetailModalHeader = styled(ModalHeader)`
  padding: 1.5rem 2rem;
  background-color: var(--background-light);
  border-bottom: 1px solid var(--border-color);
`;

// Create a component for editable item detail modal title
const ItemDetailModalTitle = styled.div`
  display: flex;
  flex-direction: column;
  
  span {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
    font-weight: 600;
  }
`;

// Create a component for editable item detail modal subtitle
const ItemDetailModalSubtitle = styled.span`
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
`;

// Create a component for editable close button
const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
  width: 1.25rem;
  
  &:hover {
    color: var(--text-primary);
  }
`;

// Create a component for editable modal body
const ItemDetailModalBody = styled(ModalBody)`
  padding: 2rem;
  background-color: var(--background-main);
`;

// Create a component for editable modal footer
const ItemDetailModalFooter = styled(ModalFooter)`
  padding: 1.25rem 1.5rem;
`;

// Create a component for editable modal description
const ModalDescription = styled.p`
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
`;

// Create a component for editable modal actions
const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

// Create a component for editable loading container
const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  min-height: 300px;
`;

// Create a component for editable loading text
const LoadingText = styled.p`
  margin-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

// Create a component for editable error container
const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  min-height: 300px;
  color: var(--error-color);
`;

// Create a component for editable error icon
const ErrorIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 1rem;
`;

// Create a component for editable empty state container
const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  min-height: 300px;
  color: var(--text-secondary);
`;

// Create a component for editable empty state icon
const EmptyStateIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 1rem;
`;

// Create a component for editable empty state message
const EmptyStateMessage = styled.p`
  text-align: center;
  max-width: 400px;
  font-size: 0.875rem;
`;

// Create a component for editable details grid
const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
`;

// Create a component for editable detail item
const DetailItem = styled.div<{ span?: number }>`
  font-size: 0.85rem;
  color: var(--text-secondary);
  ${props => props.span && `grid-column: span ${props.span};`}
  
  strong {
    color: var(--text-primary);
    font-weight: 600;
    margin-right: 0.5rem;
  }
`;

// Create a component for editable detail label
const DetailLabel = styled.label`
  font-weight: 600;
  color: var(--text-primary);
`;

// Create a component for editable detail value
const DetailValue = styled.span`
  margin-left: 1rem;
  color: var(--text-secondary);
`;

// Create a component for editable status badge
const StatusBadge = styled.span<{ $status: string }>`
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background-color: ${props => 
    props.$status === 'published' ? 'rgba(72, 187, 120, 0.1)' :
    props.$status === 'draft' ? 'rgba(237, 137, 54, 0.1)' :
    'rgba(66, 153, 225, 0.1)'
  };
  color: ${props => 
    props.$status === 'published' ? 'var(--success-color)' :
    props.$status === 'draft' ? 'var(--warning-color)' :
    'var(--info-color)'
  };
`;

// Create a component for editable toggle container
const EditToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

// Create a component for editable toggle label
const EditToggleLabel = styled.label`
  font-weight: 600;
  color: var(--text-primary);
`;

// Create a component for editable toggle
const EditToggle = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

// Create a component for editable text field
const EditTextField = styled.input`
  padding: 0.45rem 0.8rem;
  border: 1.5px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--text-primary, #222);
  font-size: 0.97rem;
  width: 100%;
  margin-bottom: 0.1rem;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03) inset;
  transition: border-color 0.18s, box-shadow 0.18s;
  &:focus {
    outline: none;
    border-color: var(--primary-color, #6366f1);
    box-shadow: 0 0 0 2px var(--primary-color, #6366f1), 0 1px 2px rgba(0,0,0,0.03) inset;
    background: #fff;
  }
`;

// Create a component for editable text area
const EditTextArea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 8px;
  background-color: var(--background-main, #fff);
  color: var(--text-primary, #222);
  font-size: 1rem;
  width: 100%;
  min-height: 120px;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: var(--primary-color, #3182ce);
    box-shadow: 0 0 0 2px var(--primary-color-light, #90cdf4);
  }
`;

// Modern edit icon button
const EditButton = styled.button`
  background: none;
  border: none;
  color: var(--border-color);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: 0.5rem;
  display: flex;
  align-items: center;
  opacity: 1;
  transition: color 0.15s;
  &:hover {
    color: var(--primary-color);
    background: var(--background-light);
  }
`;

// Create a component for editable color picker
const EditColorPicker = styled.input`
  width: 100%;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
`;

// Define styled components for editable fields
const EditFieldContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.2rem 0 0.2rem 0;
  background: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  margin-bottom: 0;
`;

const EditColorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EditColorSwatch = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
`;

const EditColorInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-light);
  }
`;

// Create a component for editable color field container
const ColorFieldContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

// Create a component for editable color value
const ColorValue = styled.span`
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--background-main);
  border-radius: 4px;
  border: 1px solid var(--border-color);
`;

// Create a component for editable color swatch
const ColorSwatch = styled.div<{ $color: string }>`
  width: 32px;
  height: 32px;
  background-color: ${props => props.$color};
  border-radius: 6px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
`;

// Create a component for editable field actions
const EditFieldActions = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-top: 0;
`;

// Create a component for editable field button
const EditFieldButton = styled.button<{ $primary?: boolean }>`
  padding: 0.38rem 1.1rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.97rem;
  cursor: pointer;
  border: none;
  margin-left: 0;
  background: ${({ $primary }) => $primary ? 'var(--primary-color)' : 'transparent'};
  color: ${({ $primary }) => $primary ? '#fff' : 'var(--text-secondary, #555)'};
  box-shadow: ${({ $primary }) => $primary ? '0 2px 8px rgba(99,102,241,0.10)' : 'none'};
  border: ${({ $primary }) => $primary ? 'none' : '1.5px solid var(--border-color, #d1d5db)'};
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
  &:hover, &:focus {
    background: ${({ $primary }) => $primary ? 'var(--primary-hover)' : 'var(--hover-color)'};
    color: ${({ $primary }) => $primary ? '#fff' : 'var(--primary-color)'};
    box-shadow: ${({ $primary }) => $primary ? '0 4px 16px rgba(99,102,241,0.13)' : 'none'};
  }
`;

// Add these styled components for the enhanced item detail modal
const ItemDetailModalWrapper = styled(ItemDetailModalContent)`
  width: 100%;
  max-width: 1240px;
  min-width: 600px;
  max-height: 92vh;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  background: #fff;
  border: 1px solid var(--border-color, #e5e7eb);
  padding: 0;
  overflow: hidden;
`;

const ItemDetailModalHeaderStyled = styled(ItemDetailModalHeader)`
  padding: 1rem 2rem 0.7rem 2rem;
  background: #fff;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
`;

const ItemDetailModalTitleStyled = styled(ItemDetailModalTitle)`
  span {
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1.2;
  }
`;

const ItemDetailModalSubtitleStyled = styled(ItemDetailModalSubtitle)`
  color: var(--text-secondary);
  font-size: 1rem;
  margin-top: 0.2rem;
`;

const ItemDetailModalBodyStyled = styled(ItemDetailModalBody)`
  padding: 1.2rem 2rem 1.2rem 2rem;
  background: #fff;
  overflow-y: auto;
  max-height: calc(92vh - 90px);
`;

const ItemDetailModalFooterStyled = styled(ItemDetailModalFooter)`
  padding: 1.2rem 2rem;
  background: var(--background-light, #f8fafc);
  border-top: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

const ItemDetailHeaderActions = styled.div`
  display: flex;
  gap: 1rem;
`;

const FieldTypeLabel = styled.span`
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  color: var(--text-secondary);
  margin-left: 0.5rem;
`;

interface EditModeButtonProps {
  disabled?: boolean;
}

const EditModeButton = styled.button<EditModeButtonProps>`
  background: var(--primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.3rem;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 8px rgba(99,102,241,0.10);
  cursor: pointer;
  transition: background 0.18s, box-shadow 0.18s, color 0.18s;
  &:hover, &:focus {
    background: var(--primary-hover);
    color: #fff;
    box-shadow: 0 4px 16px rgba(99,102,241,0.13);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SaveButton = styled(ImportedActionButton)`
  background-color: var(--primary-color);
  color: white;
  border: none;
  
  &:hover {
    background-color: var(--primary-hover);
  }
`;

const CancelButton = styled(ImportedActionButton)`
  background-color: transparent;
  color: var(--text-secondary);
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

// --- Normalization utility for Webflow API v2 item data ---
function normalizeWebflowItem(item: any): any {
  if (!item) return item;
  // If item has fieldData, flatten it into the root object
  if (item.fieldData && typeof item.fieldData === 'object') {
    return {
      ...item,
      ...item.fieldData,
    };
  }
  return item;
}

// Utility to prettify a slug
function prettifySlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Add new styled components for flexbox-based field rows
const ItemDetailFlexRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 0.3rem 0 0.3rem 0;
  font-size: 0.95rem;
  border-bottom: none;
  background: transparent;
  &:not(:last-child) {
    margin-bottom: 0.2rem;
  }
  &.editing, &:focus-within {
    background: #f3f4f6;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(99,102,241,0.07);
  }
`;
const ItemDetailFlexLabel = styled.div`
  flex: 0 0 160px;
  font-weight: 700;
  color: #444;
  font-size: 0.95rem;
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  min-width: 220px;
  padding-right: 0.7rem;
  line-height: 1.3;
  letter-spacing: 0.01em;
`;
const ItemDetailFlexValue = styled.div`
  flex: 1 1 auto;
  color: #222;
  font-size: 0.95rem;
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  word-break: break-word;
  min-width: 0;
  line-height: 1.4;
`;
// For rich text and image fields, use a card-like container
const FieldCard = styled.div`
  background: #fafbfc;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  border: 1px solid var(--border-color, #e5e7eb);
  padding: 0.8rem 1.1rem;
  margin-bottom: 0.2rem;
  font-size: 0.95rem;
`;

const CMSEditor = (): ReactElement => {
  const { selectedProject } = useProjectContext();
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
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    collection: null,
    items: [],
    availableColumns: [],
    visibleColumns: [],
    isLoading: false
  });
  const [itemDetailModal, setItemDetailModal] = useState<ItemDetailModalState>({
    isOpen: false,
    collection: null,
    item: null,
    itemDetails: null,
    isLoading: false,
    editMode: false,
    editingFields: {},
    fieldEdits: {},
    isSaving: false
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WebflowCollection;
    direction: 'ascending' | 'descending';
  }>({ key: 'name', direction: 'ascending' });
  const [loadingAction, setLoadingAction] = useState<{
    type: 'details' | 'edit' | null;
    collectionId: string | null;
  }>({ type: null, collectionId: null });
  const [metadataCollapsed, setMetadataCollapsed] = useState(true);
  const [imageEditState, setImageEditState] = useState<{ [fieldSlug: string]: boolean }>({});
  // Add a new state for image previews to avoid using hooks inside map function
  const [imagePreviewUrls, setImagePreviewUrls] = useState<{ [fieldSlug: string]: string | null }>({});
  const [webflowSiteId, setWebflowSiteId] = useState<string>('');

  // Fetch the real Webflow siteId for the selected project
  useEffect(() => {
    const fetchSiteId = async () => {
      if (!selectedProject?.token) return;
      try {
        const response = await webflowAPI.getSites(selectedProject.token);
        const sites = response.data.sites || [];
        if (sites.length > 0) {
          setWebflowSiteId(sites[0].id);
        }
      } catch (err) {
        setWebflowSiteId('');
      }
    };
    fetchSiteId();
  }, [selectedProject]);

  // Only fetch collections for the selected project
  useEffect(() => {
    if (!selectedProject || !selectedProject.token) return;
    fetchCollections(selectedProject.token);
    // eslint-disable-next-line
  }, [selectedProject]);

  // Initialize image preview URLs when item details change
  useEffect(() => {
    if (itemDetailModal.collection?.fields && itemDetailModal.itemDetails) {
      const imageFields = itemDetailModal.collection.fields.filter(field => field.type === 'Image');
      
      // Initialize preview URLs for all image fields
      const initialPreviews: {[fieldSlug: string]: string | null} = {};
      imageFields.forEach(field => {
        const itemKey = findMatchingKey(field.slug, itemDetailModal.itemDetails);
        const value = itemDetailModal.itemDetails[itemKey];
        const imgUrl = typeof value === 'object' ? value.url : value;
        initialPreviews[field.slug] = imgUrl || null;
      });
      
      setImagePreviewUrls(initialPreviews);
    }
  }, [itemDetailModal.collection, itemDetailModal.itemDetails]);

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

  const fetchCollectionDetails = async (collection: WebflowCollection): Promise<void> => {
    setLoadingDetails(true);
    setError('');
    try {
      if (!selectedProject?.token) {
        throw new Error('No project token available');
      }
      const response = await webflowAPI.getCollectionDetails(collection.id, selectedProject.token);
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

  const handleMenuOptionClick = (option: string, collectionId: string) => {
    // Find the collection from the ID
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    // Close dropdown
    setActiveDropdown(null);
    
    // Set the loading state
    setLoadingAction({
      type: option === 'details' ? 'details' : 'edit',
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
      case 'edit':
        fetchCollectionItems(collection);
        break;
      default:
        setLoadingAction({ type: null, collectionId: null });
        break;
    }
  };

  // Function to fetch collection items
  const fetchCollectionItems = async (collection: WebflowCollection) => {
    if (!selectedProject?.token) {
      setLoadingAction({ type: null, collectionId: null });
      return;
    }

    setEditModal({
      isOpen: true,
      collection,
      items: [],
      availableColumns: [],
      visibleColumns: [],
      isLoading: true
    });

    try {
      const response = await webflowAPI.getCollectionItems(collection.id, selectedProject.token);
      const items = response.data?.items || [];
      
      // Extract all unique column names from the items
      const allColumns = new Set<string>();
      items.forEach((item: WebflowCollectionItem) => {
        Object.keys(item).forEach(key => {
          if (key !== '_id' && key !== 'id' && key !== '_draft' && key !== '_archived') {
            allColumns.add(key);
          }
        });
      });
      
      // Default columns to display
      const defaultColumns = ['name', 'slug', 'status', 'updated', 'created', 'publishedOn'];
      const availableColumns = Array.from(allColumns);
      
      // Sort columns to put default columns first
      availableColumns.sort((a, b) => {
        const aIndex = defaultColumns.indexOf(a);
        const bIndex = defaultColumns.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      // All columns visible by default
      setEditModal({
        isOpen: true,
        collection,
        items,
        availableColumns,
        visibleColumns: availableColumns,
        isLoading: false
      });
    } catch (err: any) {
      setEditModal({
        isOpen: true,
        collection,
        items: [],
        availableColumns: [],
        visibleColumns: [],
        isLoading: false,
        error: err.response?.data?.message || err.message || 'Failed to fetch collection items'
      });
    } finally {
      setLoadingAction({ type: null, collectionId: null });
    }
  };

  const closeModal = () => {
    setModal({ isOpen: false, collection: null, collectionDetails: null });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      collection: null,
      items: [],
      availableColumns: [],
      visibleColumns: [],
      isLoading: false
    });
  };

  const closeItemDetailModal = () => {
    setItemDetailModal({
      isOpen: false,
      collection: null,
      item: null,
      itemDetails: null,
      isLoading: false,
      editMode: false,
      editingFields: {},
      fieldEdits: {},
      isSaving: false
    });
  };

  // Updated fetchItemDetails with normalization
  const fetchItemDetails = async (collection: WebflowCollection, item: WebflowCollectionItem) => {
    if (!selectedProject?.token) {
      return;
    }

    setItemDetailModal({
      isOpen: true,
      collection,
      item,
      itemDetails: null,
      isLoading: true,
      editMode: false,
      editingFields: {},
      fieldEdits: {},
      isSaving: false
    });

    try {
      // Fetch item details
      const itemResponse = await webflowAPI.getCollectionItem(
        collection.id,
        item.id || item._id,
        selectedProject.token
      );

      // Fetch full collection details (with fields)
      const collectionResponse = await webflowAPI.getCollectionDetails(
        collection.id,
        selectedProject.token
      );
      const fullCollection = {
        ...collection,
        ...collectionResponse.data.collection // This should include the fields array
      };

      // Normalize item details for Webflow API v2 (flatten fieldData)
      const normalizedItemDetails = normalizeWebflowItem(itemResponse.data);

      setItemDetailModal({
        isOpen: true,
        collection: fullCollection, // Use the full collection with fields
        item,
        itemDetails: normalizedItemDetails,
        isLoading: false,
        editMode: false,
        editingFields: {},
        fieldEdits: {},
        isSaving: false
      });
    } catch (err: any) {
      setItemDetailModal({
        isOpen: true,
        collection,
        item,
        itemDetails: null,
        isLoading: false,
        editMode: false,
        editingFields: {},
        fieldEdits: {},
        isSaving: false,
        error: err.response?.data?.message || err.message || 'Failed to fetch item details'
      });
    }
  };

  const toggleColumn = (column: string) => {
    setEditModal(prev => {
      if (prev.visibleColumns.includes(column)) {
        // Remove the column
        return {
          ...prev,
          visibleColumns: prev.visibleColumns.filter(col => col !== column)
        };
      } else {
        // Add the column
        return {
          ...prev,
          visibleColumns: [...prev.visibleColumns, column]
        };
      }
    });
  };

  // Component for rich text display
  const RichTextField = ({ value }: { value: string }) => {
    const [isHtmlExpanded, setIsHtmlExpanded] = useState(false);
    return (
      <RichTextContainer>
        <RichTextPreview dangerouslySetInnerHTML={{ __html: value }} />
        {isHtmlExpanded ? (
          <>
            <RawHtmlContent>{value}</RawHtmlContent>
            <ShowRawHtmlButton onClick={() => setIsHtmlExpanded(false)}>
              Hide Raw HTML
            </ShowRawHtmlButton>
          </>
        ) : (
          <ShowRawHtmlButton onClick={() => setIsHtmlExpanded(true)}>
            View Raw HTML
          </ShowRawHtmlButton>
        )}
      </RichTextContainer>
    );
  };

  // Component for expandable text
  const ExpandableTextField = ({ value }: { value: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
      <>
        <ExpandableText>
          {isExpanded ? value : `${value.substring(0, 100)}...`}
        </ExpandableText>
        <ShowMoreButton onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show less' : 'Show more'}
        </ShowMoreButton>
      </>
    );
  };

  // Create a component for editable text field
  const EditableTextField = ({ 
    value, 
    fieldName, 
    isEditing, 
    onChange, 
    onSave, 
    onCancel, 
    inputType = 'text' 
  }: { 
    value: string, 
    fieldName: string, 
    isEditing: boolean, 
    onChange: (value: string) => void, 
    onSave: () => void, 
    onCancel: () => void, 
    inputType?: string 
  }) => {
    const [localValue, setLocalValue] = React.useState(value);
    React.useEffect(() => {
      if (isEditing) setLocalValue(value);
    }, [isEditing, value]);
    if (!isEditing) {
      return <span>{value}</span>;
    }
    return (
      <EditFieldContainer>
        <EditTextField 
          type={inputType}
          value={localValue}
          onChange={e => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }} 
          autoFocus
        />
        <EditFieldActions>
          <EditFieldButton onClick={onSave} $primary>
            Save
          </EditFieldButton>
          <EditFieldButton onClick={onCancel}>
            Cancel
          </EditFieldButton>
        </EditFieldActions>
      </EditFieldContainer>
    );
  };

  // Create a component for editable long text field
  const EditableLongTextField = ({ 
    value, 
    fieldName, 
    isEditing, 
    onChange, 
    onSave, 
    onCancel 
  }: { 
    value: string, 
    fieldName: string, 
    isEditing: boolean, 
    onChange: (value: string) => void, 
    onSave: () => void, 
    onCancel: () => void 
  }) => {
    const [localValue, setLocalValue] = React.useState(value);
    React.useEffect(() => {
      if (isEditing) setLocalValue(value);
    }, [isEditing, value]);
    if (!isEditing) {
      return <ExpandableTextField value={value} />;
    }
    return (
      <EditFieldContainer>
        <EditTextArea 
          value={localValue}
          onChange={e => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }} 
          rows={5}
          autoFocus
        />
        <EditFieldActions>
          <EditFieldButton onClick={onSave} $primary>
            Save
          </EditFieldButton>
          <EditFieldButton onClick={onCancel}>
            Cancel
          </EditFieldButton>
        </EditFieldActions>
      </EditFieldContainer>
    );
  };

  // Modern styled file input button
  const FileInputLabel = styled.label`
    display: inline-block;
    background: var(--primary-color);
    color: white;
    border-radius: 4px;
    padding: 0.4rem 1.2rem;
    font-size: 0.95rem;
    cursor: pointer;
    margin-right: 1rem;
    margin-top: 0.5rem;
    &:hover {
      background: var(--primary-hover);
    }
  `;
  const FileInput = styled.input`
    display: none;
  `;
  const ImagePreview = styled.div`
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  `;
  const ImagePreviewItem = styled.div`
    position: relative;
    display: inline-block;
  `;
  const RemoveImageButton = styled.button`
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0,0,0,0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1rem;
    z-index: 2;
    &:hover {
      background: var(--error-color);
    }
  `;

  // Modern rich text editor container (contenteditable)
  const ModernContentEditable = styled.div`
    min-height: 180px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-main);
    padding: 1rem;
    font-size: 1rem;
    outline: none;
    margin-bottom: 1rem;
    &:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px var(--primary-color-light);
    }
  `;

  // Add toolbar button and toolbar for rich text
  const ToolbarButton = styled.button`
    background: var(--background-light, #f5f5f5);
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    margin-right: 0.5rem;
    padding: 0.3rem 0.7rem;
    font-size: 1rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.2em;
    min-height: 2.2em;
    color: var(--text-primary, #222);
    &:hover {
      background: var(--primary-hover, #3182ce);
      color: white;
    }
  `;

  // Add image input for toolbar
  const ToolbarFileInput = styled.input`
    display: none;
  `;

  const RichTextToolbar = ({ editorRef, onImageInsert, imageButtonDisabled }: { editorRef: React.RefObject<HTMLDivElement | null>, onImageInsert: (file: File) => void, imageButtonDisabled?: boolean }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const format = (command: string, value?: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
      }
    };
    const handleImageClick = () => {
      if (fileInputRef.current) fileInputRef.current.click();
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImageInsert(file);
        e.target.value = '';
      }
    };
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        {[1,2,3,4,5,6].map(h => (
          <ToolbarButton key={h} type="button" onClick={() => format('formatBlock', `<h${h}>`)}>
            <span style={{fontWeight:'bold',fontSize: h === 1 ? '1.2em' : undefined}}>{`H${h}`}</span>
          </ToolbarButton>
        ))}
        <ToolbarButton type="button" onClick={() => format('formatBlock', '<p>')}>P</ToolbarButton>
        <ToolbarButton type="button" onClick={() => format('bold')}><b>B</b></ToolbarButton>
        <ToolbarButton type="button" onClick={() => format('italic')}><i>I</i></ToolbarButton>
        <ToolbarButton type="button" onClick={() => format('underline')}><u>U</u></ToolbarButton>
        <ToolbarButton type="button" onClick={handleImageClick} title="Insert Image" disabled={imageButtonDisabled}>
          🖼️
          <ToolbarFileInput ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
        </ToolbarButton>
      </div>
    );
  };

  // Replace EditableRichTextField with a version that supports image upload and all headings
  const EditableRichTextField = ({
    value,
    fieldName,
    isEditing,
    onChange,
    onSave,
    onCancel,
    webflowSiteId,
    projectToken
  }: {
    value: string,
    fieldName: string,
    isEditing: boolean,
    onChange: (value: string) => void,
    onSave: () => void,
    onCancel: () => void,
    webflowSiteId: string,
    projectToken: string
  }) => {
    const editableRef = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = React.useState(value);
    const [uploading, setUploading] = useState(false);

    React.useEffect(() => {
      if (isEditing) setLocalValue(value);
    }, [isEditing, value]);

    const insertImageAtCursor = (url: string) => {
      if (editableRef.current) {
        editableRef.current.focus();
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.collapse(false);
          range.insertNode(img);
          // Move cursor after image
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editableRef.current.appendChild(img);
        }
      }
    };

    const handleImageInsert = async (file: File) => {
      if (!projectToken || !webflowSiteId) {
        alert('Webflow site is not ready yet. Please wait and try again.');
        return;
      }
      setUploading(true);
      try {
        const fileBuffer = await file.arrayBuffer();
        // @ts-ignore
        const SparkMD5 = (await import('spark-md5')).default;
        const fileHash = SparkMD5.ArrayBuffer.hash(fileBuffer);
        const metaRes = await webflowAPI.createAssetMetadata(
          webflowSiteId,
          file.name,
          fileHash,
          projectToken
        );
        const { uploadUrl, uploadDetails } = metaRes.data;
        const s3Form = new FormData();
        Object.entries(uploadDetails).forEach(([key, value]) => {
          s3Form.append(key, value as string);
        });
        s3Form.append('file', file);
        await fetch(uploadUrl, { method: 'POST', body: s3Form });
        const hostedUrl = metaRes.data.hostedUrl || `https://${uploadDetails.bucket}.s3.amazonaws.com/${uploadDetails.key}`;
        insertImageAtCursor(hostedUrl);
        if (editableRef.current) {
          setLocalValue(editableRef.current.innerHTML);
        }
      } catch (err) {
        alert('Image upload failed: ' + ((err as any)?.message || String(err)));
      }
      setUploading(false);
    };

    if (!isEditing) {
      return <RichTextField value={value} />;
    }
    const handleSave = () => {
      if (editableRef.current) {
        const html = editableRef.current.innerHTML;
        setLocalValue(html);
        onChange(html);
        onSave(); // exit edit mode
      }
    };
    const handleCancel = () => {
      setLocalValue(value);
      onCancel(); // exit edit mode
    };
    return (
      <EditFieldContainer>
        <RichTextToolbar editorRef={editableRef} onImageInsert={handleImageInsert} imageButtonDisabled={!webflowSiteId || uploading} />
        <ModernContentEditable
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          defaultValue={localValue}
          dangerouslySetInnerHTML={{ __html: localValue }}
          aria-label={fieldName}
        />
        {uploading && <div style={{ color: 'var(--primary-color)', fontSize: '0.9em', margin: '0.5em 0' }}>Uploading image...</div>}
        {!webflowSiteId && <div style={{ color: 'var(--error-color)', fontSize: '0.9em', margin: '0.5em 0' }}>Webflow site is not ready yet. Please wait...</div>}
        <EditFieldActions>
          <EditFieldButton onClick={handleSave} $primary>
            Save
          </EditFieldButton>
          <EditFieldButton onClick={handleCancel}>
            Cancel
          </EditFieldButton>
        </EditFieldActions>
      </EditFieldContainer>
    );
  };

  // Create a component for editable boolean field
  const EditableBooleanField = ({ 
    value, 
    fieldName, 
    isEditing, 
    onChange, 
    onSave, 
    onCancel 
  }: { 
    value: boolean, 
    fieldName: string, 
    isEditing: boolean, 
    onChange: (value: boolean) => void, 
    onSave: () => void, 
    onCancel: () => void 
  }) => {
    if (!isEditing) {
      return value ? 
        <StatusBadge $status="active"><FiCheck color="var(--success-color)" /> Enabled</StatusBadge> : 
        <StatusBadge $status="inactive"><FiX color="var(--error-color)" /> Disabled</StatusBadge>;
    }
    
    return (
      <EditFieldContainer>
        <EditToggleContainer>
          <EditToggle 
            type="checkbox" 
            checked={value} 
            onChange={(e) => onChange(e.target.checked)} 
            id={`toggle-${fieldName}`}
          />
          <EditToggleLabel htmlFor={`toggle-${fieldName}`}>
            {value ? 'Enabled' : 'Disabled'}
          </EditToggleLabel>
        </EditToggleContainer>
        <EditFieldActions>
          <EditFieldButton onClick={onSave} $primary>
            <FiCheck />
          </EditFieldButton>
          <EditFieldButton onClick={onCancel}>
            <FiX />
          </EditFieldButton>
        </EditFieldActions>
      </EditFieldContainer>
    );
  };

  // Create a component for editable color field
  const EditableColorField = ({ 
    value, 
    fieldName, 
    isEditing, 
    onChange, 
    onSave, 
    onCancel 
  }: { 
    value: string, 
    fieldName: string, 
    isEditing: boolean, 
    onChange: (value: string) => void, 
    onSave: () => void, 
    onCancel: () => void 
  }) => {
    if (!isEditing) {
      return (
        <ColorFieldContainer>
          <ColorSwatch $color={value} />
          <ColorValue>{value}</ColorValue>
        </ColorFieldContainer>
      );
    }
    
    return (
      <EditFieldContainer>
        <EditColorContainer>
          <EditColorSwatch style={{ backgroundColor: value }} />
          <EditColorInput 
            type="text" 
            value={value} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} 
            autoFocus
          />
        </EditColorContainer>
        <EditFieldActions>
          <EditFieldButton onClick={onSave} $primary>
            <FiCheck />
          </EditFieldButton>
          <EditFieldButton onClick={onCancel}>
            <FiX />
          </EditFieldButton>
        </EditFieldActions>
      </EditFieldContainer>
    );
  };

  // Add explicit types for the parameters of the findMatchingKey function
  function findMatchingKey(slug: string, item: Record<string, any>) {
    if (item.hasOwnProperty(slug)) return slug;
    // Use correct callback signature for replace
    const camel = slug.replace(/-([a-z])/g, (_substring: string, group: string) => group.toUpperCase());
    if (item.hasOwnProperty(camel)) return camel;
    const snake = slug.replace(/-/g, '_');
    if (item.hasOwnProperty(snake)) return snake;
    if (item.hasOwnProperty(slug.toLowerCase())) return slug.toLowerCase();
    if (item.hasOwnProperty(slug.toUpperCase())) return slug.toUpperCase();
    const noDash = slug.replace(/-/g, '');
    if (item.hasOwnProperty(noDash)) return noDash;
    return slug;
  }

  // Modern toggle switch for boolean fields
  const ToggleSwitch = styled.label`
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
    input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    span {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 28px;
    }
    span:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    input:checked + span {
      background-color: var(--primary-color);
    }
    input:checked + span:before {
      transform: translateX(20px);
    }
  `;

  // Editing field container improvements
  const EditFieldContainer = styled.div`
    position: relative;
    margin-bottom: 1.5rem;
    background: var(--background-light);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    padding: 1rem;
  `;

  // For image editing
  const ImageEditContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
  `;
  const ImageEditButton = styled.button`
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    margin-left: 1rem;
    &:hover {
      background: var(--primary-hover);
    }
  `;

  // Collapsible section for Item Metadata
  const CollapsibleSection = styled.div`
    margin-bottom: 2rem;
  `;
  const CollapsibleHeader = styled.div`
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
  `;
  const CollapseIcon = styled.span`
    display: inline-block;
    margin-right: 0.75rem;
    font-size: 1.2em;
    transition: transform 0.2s;
  `;

  // Place SectionDivider after all other styled components
  const SectionDivider = styled.hr`
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 2rem 0 1rem 0;
  `;

  return (
    <CmsEditorContainer>
      <CmsHeader>
        <h1>CMS Collections Editor</h1>
        <p>Manage and edit your Webflow CMS collections</p>
      </CmsHeader>

      <FiltersContainer>
        <SearchInput 
          type="text"
          placeholder="Search collections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <RefreshButton onClick={() => selectedProject && fetchCollections(selectedProject.token)}>
          <FiRefreshCw /> Refresh
        </RefreshButton>
      </FiltersContainer>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {loading ? (
        <LoadingMessage>Loading collections...</LoadingMessage>
      ) : filteredCollections.length === 0 ? (
        <NoDataMessage>
          {searchTerm ? 'No collections match your search.' : 'No collections found.'}
        </NoDataMessage>
      ) : (
        <>
          <CollectionsCount>
            Showing {filteredCollections.length} of {collections.length} collections
          </CollectionsCount>
          <CollectionsTable>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')}>
                  Name {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('slug')}>
                  Slug {sortConfig.key === 'slug' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('itemCount')}>
                  Items {sortConfig.key === 'itemCount' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('lastUpdated')}>
                  Last Updated {sortConfig.key === 'lastUpdated' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollections.map(collection => (
                <tr key={collection.id}>
                  <td>{collection.name}</td>
                  <td>{collection.slug}</td>
                  <td>
                    {collection.itemCount}
                    {collection.stagedItemCount !== undefined && collection.liveItemCount !== undefined && (
                      <ItemCounts>
                        ({collection.stagedItemCount} staged, {collection.liveItemCount} live)
                      </ItemCounts>
                    )}
                  </td>
                  <td>{formatDate(collection.lastUpdated)}</td>
                  <td>
                    <ActionButtons>
                      <ActionButton 
                        onClick={() => handleMenuOptionClick('details', collection.id)}
                        disabled={loadingAction.collectionId === collection.id && loadingAction.type === 'details'}
                        className="details-button"
                      >
                        {loadingAction.collectionId === collection.id && loadingAction.type === 'details' ? (
                          <span>Loading...</span>
                        ) : (
                          <span><FiSearch /> Details</span>
                        )}
                      </ActionButton>
                      <ActionButton 
                        onClick={() => handleMenuOptionClick('edit', collection.id)}
                        disabled={loadingAction.collectionId === collection.id && loadingAction.type === 'edit'}
                        className="edit-button"
                      >
                        {loadingAction.collectionId === collection.id && loadingAction.type === 'edit' ? (
                          <span>Loading...</span>
                        ) : (
                          <span><FiEdit /> Edit Items</span>
                        )}
                      </ActionButton>
                    </ActionButtons>
                  </td>
                </tr>
              ))}
            </tbody>
          </CollectionsTable>
        </>
      )}

      {/* Collection Details Modal */}
      {modal.isOpen && modal.collection && (
        <ModalOverlay onClick={closeModal}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{modal.collection.name}</ModalTitle>
              <ImportedCloseButton onClick={closeModal}>×</ImportedCloseButton>
            </ModalHeader>
            <ModalBody>
              {loadingDetails ? (
                <LoadingContainer>
                  <LoadingText>Loading collection details...</LoadingText>
                </LoadingContainer>
              ) : modal.error ? (
                <ErrorContainer>
                  <ErrorIcon>⚠️</ErrorIcon>
                  <div>{modal.error}</div>
                </ErrorContainer>
              ) : !modal.collectionDetails ? (
                <EmptyStateContainer>
                  <EmptyStateIcon>📂</EmptyStateIcon>
                  <EmptyStateMessage>No details available for this collection.</EmptyStateMessage>
                </EmptyStateContainer>
              ) : (
                <DetailsGrid>
                  <DetailItem>
                    <strong>ID:</strong> {modal.collectionDetails.id}
                  </DetailItem>
                  <DetailItem>
                    <strong>Name:</strong> {modal.collectionDetails.name}
                  </DetailItem>
                  <DetailItem>
                    <strong>Slug:</strong> {modal.collectionDetails.slug}
                  </DetailItem>
                  <DetailItem>
                    <strong>Item Count:</strong> {modal.collectionDetails.itemCount}
                  </DetailItem>
                  <DetailItem>
                    <strong>Created:</strong> {formatDate(modal.collectionDetails.createdOn)}
                  </DetailItem>
                  <DetailItem>
                    <strong>Last Updated:</strong> {formatDate(modal.collectionDetails.lastUpdated)}
                  </DetailItem>
                  <DetailItem span={2}>
                    <strong>Site:</strong> {modal.collectionDetails.siteName}
                  </DetailItem>
                  {modal.collectionDetails.fields && (
                    <DetailItem span={2}>
                      <strong>Fields:</strong>
                      <FieldsList>
                        {modal.collectionDetails.fields.map((field: any) => (
                          <FieldItem key={field.id}>
                            <div>
                              <FieldName>{field.name}</FieldName>
                              <FieldType>{field.type}</FieldType>
                              {field.required && <RequiredBadge>Required</RequiredBadge>}
                            </div>
                            <FieldSlug>{field.slug}</FieldSlug>
                          </FieldItem>
                        ))}
                      </FieldsList>
                    </DetailItem>
                  )}
                </DetailsGrid>
              )}
            </ModalBody>
            <ModalFooter>
              <ImportedActionButton onClick={closeModal}>Close</ImportedActionButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Edit Collection Items Modal */}
      {editModal.isOpen && editModal.collection && (
        <ModalOverlay onClick={closeEditModal}>
          <EditModalContent onClick={e => e.stopPropagation()}>
            <EditModalHeader>
              <EditModalTitle>
                <span>{editModal.collection.name}</span>
                <EditModalSubtitle>Edit collection items</EditModalSubtitle>
              </EditModalTitle>
              <ImportedCloseButton onClick={closeEditModal}>×</ImportedCloseButton>
            </EditModalHeader>
            
            <EditModalBody>
              {editModal.isLoading ? (
                <LoadingContainer>
                  <LoadingText>Loading collection items...</LoadingText>
                </LoadingContainer>
              ) : editModal.error ? (
                <ErrorContainer>
                  <ErrorIcon>⚠️</ErrorIcon>
                  <div>{editModal.error}</div>
                </ErrorContainer>
              ) : editModal.items.length === 0 ? (
                <EmptyStateContainer>
                  <EmptyStateIcon>📄</EmptyStateIcon>
                  <EmptyStateMessage>No items found in this collection.</EmptyStateMessage>
                </EmptyStateContainer>
              ) : (
                <>
                  <ColumnToggleContainer>
                    <ColumnToggleHeader>
                      <ColumnToggleLabel>Visible Columns</ColumnToggleLabel>
                    </ColumnToggleHeader>
                    <ColumnToggleButtons>
                      {editModal.availableColumns.map(column => (
                        <ColumnToggleButton 
                          key={column}
                          $active={editModal.visibleColumns.includes(column)}
                          onClick={() => toggleColumn(column)}
                        >
                          {column}
                          {editModal.visibleColumns.includes(column) && (
                            <CheckIcon>✓</CheckIcon>
                          )}
                        </ColumnToggleButton>
                      ))}
                    </ColumnToggleButtons>
                  </ColumnToggleContainer>
                  
                  {editModal.visibleColumns.length === 0 ? (
                    <EmptyColumnsMessage>
                      Please select at least one column to display.
                    </EmptyColumnsMessage>
                  ) : (
                    <ItemsTableWrapper>
                      <ItemsTableContainer>
                        <ItemsTable>
                          <thead>
                            <tr>
                              {editModal.visibleColumns.map(column => (
                                <ItemsTableHeader key={column}>
                                  {column}
                                </ItemsTableHeader>
                              ))}
                              <ItemsTableHeader>Actions</ItemsTableHeader>
                            </tr>
                          </thead>
                          <tbody>
                            {editModal.items.map(item => (
                              <ItemsTableRow key={item._id || item.id}>
                                {editModal.visibleColumns.map(column => (
                                  <ItemsTableCell key={`${item._id || item.id}-${column}`}>
                                    {item[column] !== undefined ? 
                                      (typeof item[column] === 'object' ? 
                                        JSON.stringify(item[column]).substring(0, 50) + '...' : 
                                        String(item[column]).substring(0, 50)) : 
                                      '-'}
                                  </ItemsTableCell>
                                ))}
                                <ItemsTableCell>
                                  <ImportedActionButton 
                                    onClick={() => fetchItemDetails(editModal.collection!, item)}
                                    className="small-button"
                                  >
                                    View
                                  </ImportedActionButton>
                                </ItemsTableCell>
                              </ItemsTableRow>
                            ))}
                          </tbody>
                        </ItemsTable>
                      </ItemsTableContainer>
                    </ItemsTableWrapper>
                  )}
                </>
              )}
            </EditModalBody>
            
            <EditModalFooter>
              <ItemsCount>
                {editModal.items.length} items
              </ItemsCount>
              <ImportedActionButton onClick={closeEditModal}>Close</ImportedActionButton>
            </EditModalFooter>
          </EditModalContent>
        </ModalOverlay>
      )}

      {/* Item Detail Modal */}
      {itemDetailModal.isOpen && itemDetailModal.collection && itemDetailModal.item && (
        <ModalOverlay onClick={itemDetailModal.editMode ? undefined : closeItemDetailModal}>
          <ItemDetailModalWrapper onClick={e => e.stopPropagation()}>
            <ItemDetailModalHeaderStyled>
              <ItemDetailModalTitleStyled>
                <span>{itemDetailModal.item.name || 'Item Details'}</span>
                <ItemDetailModalSubtitleStyled>{itemDetailModal.collection.name}</ItemDetailModalSubtitleStyled>
              </ItemDetailModalTitleStyled>
              <ItemDetailHeaderActions>
                {!itemDetailModal.editMode && (
                  <EditModeButton 
                    onClick={() => {
                      setItemDetailModal({
                        ...itemDetailModal,
                        editMode: true,
                        editingFields: {},
                        fieldEdits: {}
                      });
                    }}
                    disabled={itemDetailModal.isLoading || !!itemDetailModal.error}
                  >
                    <FiEdit /> Edit Item
                  </EditModeButton>
                )}
                <ImportedCloseButton onClick={closeItemDetailModal}>×</ImportedCloseButton>
              </ItemDetailHeaderActions>
            </ItemDetailModalHeaderStyled>
            
            <ItemDetailModalBodyStyled>
              {itemDetailModal.isLoading ? (
                <LoadingContainer>
                  <LoadingText>Loading item details...</LoadingText>
                </LoadingContainer>
              ) : itemDetailModal.error ? (
                <ErrorContainer>
                  <ErrorIcon>⚠️</ErrorIcon>
                  <div>{itemDetailModal.error}</div>
                </ErrorContainer>
              ) : !itemDetailModal.itemDetails ? (
                <EmptyStateContainer>
                  <EmptyStateIcon>📄</EmptyStateIcon>
                  <EmptyStateMessage>No details available for this item.</EmptyStateMessage>
                </EmptyStateContainer>
              ) : (
                <ItemDetailGrid>
                  <ItemDetailSection>
                    <ItemDetailSectionTitle>Item Fields</ItemDetailSectionTitle>
                    <div>
                      {itemDetailModal.collection.fields && itemDetailModal.collection.fields.map((field: any) => {
                        if (!field) return null;
                        const itemKey = findMatchingKey(field.slug, itemDetailModal.itemDetails);
                        const value = itemDetailModal.itemDetails[itemKey];
                        const isEditing = itemDetailModal.editMode && itemDetailModal.editingFields && itemDetailModal.editingFields[field.slug];
                        // Use the edited value if present, otherwise the original
                        let imgUrl = undefined;
                        if (itemDetailModal.fieldEdits && Object.prototype.hasOwnProperty.call(itemDetailModal.fieldEdits, field.slug)) {
                          const editValue = itemDetailModal.fieldEdits[field.slug];
                          imgUrl = editValue && typeof editValue === 'object' ? editValue.url : editValue;
                        } else {
                          imgUrl = typeof value === 'object' ? value.url : value;
                        }
                        // Get the current preview URL from the global state - initialization is handled in useEffect
                        const previewUrl = imagePreviewUrls[field.slug];
                        const fieldValue = (itemDetailModal.fieldEdits && Object.prototype.hasOwnProperty.call(itemDetailModal.fieldEdits, field.slug)) ? itemDetailModal.fieldEdits[field.slug] : value;
                        
                        const startEditing = () => {
                          if (!itemDetailModal.editMode) return;
                          setItemDetailModal({
                            ...itemDetailModal,
                            editingFields: {
                              ...itemDetailModal.editingFields,
                              [field.slug]: true
                            },
                            fieldEdits: {
                              ...itemDetailModal.fieldEdits,
                              [field.slug]: value
                            }
                          });
                        };
                        
                        const saveEdit = () => {
                          // For image fields, sync the preview URL with the field edit
                          if (field.type === 'Image') {
                            // Ensure the fieldEdits has the current preview URL
                            const currentPreviewUrl = imagePreviewUrls[field.slug];
                            if (currentPreviewUrl !== undefined) {
                              // If we have a preview URL (including null for removed images)
                              if (currentPreviewUrl === null) {
                                // Image was removed
                                handleChange(null);
                              } else {
                                // Image was changed or added
                                const currentEdit = itemDetailModal.fieldEdits[field.slug];
                                handleChange({
                                  url: currentPreviewUrl,
                                  fileName: typeof currentEdit === 'object' ? currentEdit.fileName || 'image' : 'image',
                                  fileSize: typeof currentEdit === 'object' ? currentEdit.fileSize : 0,
                                  fileType: typeof currentEdit === 'object' ? currentEdit.fileType : 'image/jpeg',
                                });
                              }
                            }
                          }

                          // Exit edit mode for this field
                          setItemDetailModal(prev => ({
                            ...prev,
                            editingFields: {
                              ...prev.editingFields,
                              [field.slug]: false
                            }
                          }));
                        };

                        const cancelEdit = () => {
                          setItemDetailModal({
                            ...itemDetailModal,
                            editingFields: {
                              ...itemDetailModal.editingFields,
                              [field.slug]: false
                            },
                            fieldEdits: {
                              ...itemDetailModal.fieldEdits,
                              [field.slug]: value // Reset to original value
                            }
                          });
                          
                          // Reset the preview URL when canceling
                          if (field.type === 'Image') {
                            setImagePreviewUrls(prev => ({
                              ...prev,
                              [field.slug]: imgUrl || null
                            }));
                          }
                        };

                        const handleChange = (newValue: any) => {
                          setItemDetailModal({
                            ...itemDetailModal,
                            fieldEdits: {
                              ...itemDetailModal.fieldEdits,
                              [field.slug]: newValue
                            }
                          });
                        };
                        
                        // Handle file selection for image fields
                        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          // Show a temporary preview while uploading
                          const tempPreviewUrl = URL.createObjectURL(file);
                          setImagePreviewUrls(prev => ({
                            ...prev,
                            [field.slug]: tempPreviewUrl
                          }));
                          // Set a temporary field value
                          handleChange({
                            url: tempPreviewUrl,
                            fileName: file.name,
                            fileSize: file.size,
                            fileType: file.type,
                            _isTemporary: true
                          });

                          // --- Upload to Webflow ---
                          try {
                            if (!selectedProject?.token || !itemDetailModal.collection?.siteId) {
                              throw new Error('Missing project token or siteId');
                            }
                            // Calculate file hash (for deduplication, as in Assets page)
                            const fileBuffer = await file.arrayBuffer();
                            // Use SparkMD5 for hashing (already used in Assets page)
                            // @ts-ignore
                            const SparkMD5 = (await import('spark-md5')).default;
                            const fileHash = SparkMD5.ArrayBuffer.hash(fileBuffer);
                            // Step 1: Get upload URL and metadata
                            const metaRes = await webflowAPI.createAssetMetadata(
                              itemDetailModal.collection.siteId,
                              file.name,
                              fileHash,
                              selectedProject.token
                            );
                            const { uploadUrl, uploadDetails } = metaRes.data;
                            // Step 2: Upload to S3
                            const s3Form = new FormData();
                            Object.entries(uploadDetails).forEach(([key, value]) => {
                              s3Form.append(key, value as string);
                            });
                            s3Form.append('file', file);
                            await fetch(uploadUrl, { method: 'POST', body: s3Form });
                            // Step 3: Use hostedUrl as the final image URL
                            const hostedUrl = metaRes.data.hostedUrl || `https://${uploadDetails.bucket}.s3.amazonaws.com/${uploadDetails.key}`;
                            setImagePreviewUrls(prev => ({
                              ...prev,
                              [field.slug]: hostedUrl
                            }));
                            handleChange({
                              url: hostedUrl,
                              fileName: file.name,
                              fileSize: file.size,
                              fileType: file.type
                            });
                          } catch (err) {
                            // On error, revert preview and field value
                            setImagePreviewUrls(prev => ({
                              ...prev,
                              [field.slug]: null
                            }));
                            handleChange(null);
                            alert('Image upload failed: ' + ((err as any)?.message || String(err)));
                          }
                        };

                        // Component for rendering an image field
                        const renderImageField = (): ReactElement => {
                          if (!isEditing) {
                            return (
                              <ImageFieldContainer>
                                {imgUrl ? (
                                  <>
                                    <ImageThumbnail src={imgUrl} alt={field.name || field.slug} />
                                    <ImageDetails>
                                      <span>{field.name || prettifySlug(field.slug)}</span>
                                      {itemDetailModal.editMode && (
                                        <EditButton onClick={startEditing}>
                                          <FiEdit />
                                        </EditButton>
                                      )}
                                    </ImageDetails>
                                  </>
                                ) : (
                                  <EmptyValue>No image</EmptyValue>
                                )}
                              </ImageFieldContainer>
                            );
                          }

                          return (
                            <EditFieldContainer>
                              {previewUrl && (
                                <div style={{ marginBottom: '1rem' }}>
                                  <ImageThumbnail 
                                    src={previewUrl} 
                                    alt="Preview" 
                                    style={{ width: '120px', height: '120px' }} 
                                  />
                                </div>
                              )}
                              
                              <div style={{ marginBottom: '1rem' }}>
                                <FileInputLabel htmlFor={`file-upload-${field.slug}`}>
                                  {previewUrl ? 'Change Image' : 'Upload Image'}
                                </FileInputLabel>
                                <FileInput
                                  id={`file-upload-${field.slug}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileChange}
                                />
                                
                                {previewUrl && (
                                  <button 
                                    onClick={() => {
                                      // Update the global preview URL state
                                      setImagePreviewUrls(prev => ({
                                        ...prev,
                                        [field.slug]: null
                                      }));
                                      handleChange(null);
                                    }}
                                    style={{
                                      marginLeft: '0.5rem',
                                      padding: '0.4rem 1rem',
                                      background: 'rgba(229, 62, 62, 0.1)',
                                      color: 'var(--error-color)',
                                      border: '1px solid var(--error-color)',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              
                              <EditFieldActions>
                                <EditFieldButton onClick={saveEdit} $primary>
                                  <FiCheck />
                                </EditFieldButton>
                                <EditFieldButton onClick={cancelEdit}>
                                  <FiX />
                                </EditFieldButton>
                              </EditFieldActions>
                            </EditFieldContainer>
                          );
                        };

                        // At the end of the callback, ensure a return value:
                        // If for some reason field is missing, return null
                        if (!field) return null;
                        return (
                          <ItemDetailFlexRow key={field.id || field.slug} className={`${isEditing ? 'editing' : ''} ${field.type === 'Image' ? 'image-row' : ''}`}>
                            <ItemDetailFlexLabel>
                              {field.name || prettifySlug(field.slug)}
                              <FieldTypeLabel>{field.type}</FieldTypeLabel>
                              {!isEditing && itemDetailModal.editMode && field.type !== 'Image' && (
                                <EditButton onClick={startEditing} className="edit-icon">
                                  <FiEdit />
                                </EditButton>
                              )}
                            </ItemDetailFlexLabel>
                            <ItemDetailFlexValue>
                              {value === null || value === undefined ? (
                                <EmptyValue>No value</EmptyValue>
                              ) : field.type === 'PlainText' || field.type === 'String' || field.type === 'Email' || field.type === 'Link' ? (
                                <EditableTextField
                                  value={fieldValue || ''}
                                  fieldName={field.slug}
                                  isEditing={isEditing}
                                  onChange={handleChange}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                  inputType={field.type === 'Email' ? 'email' : field.type === 'Link' ? 'url' : 'text'}
                                />
                              ) : field.type === 'RichText' ? (
                                <EditableRichTextField
                                  value={fieldValue || ''}
                                  fieldName={field.slug}
                                  isEditing={isEditing}
                                  onChange={handleChange}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                  webflowSiteId={webflowSiteId}
                                  projectToken={selectedProject?.token || ''}
                                />
                              ) : field.type === 'Boolean' ? (
                                <EditableBooleanField
                                  value={Boolean(fieldValue)}
                                  fieldName={field.slug}
                                  isEditing={isEditing}
                                  onChange={handleChange}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                />
                              ) : field.type === 'Color' ? (
                                <EditableColorField
                                  value={fieldValue || ''}
                                  fieldName={field.slug}
                                  isEditing={isEditing}
                                  onChange={handleChange}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                />
                              ) : field.type === 'Image' ? (
                                renderImageField()
                              ) : (
                                <span>{String(fieldValue)}</span>
                              )}
                            </ItemDetailFlexValue>
                          </ItemDetailFlexRow>
                        );
                      })}
                    </div>
                  </ItemDetailSection>
                </ItemDetailGrid>
              )}
            </ItemDetailModalBodyStyled>
            
            <ItemDetailModalFooterStyled>
              <div>
                {itemDetailModal.editMode && (
                  <CancelButton 
                    onClick={() => {
                      setItemDetailModal({
                        ...itemDetailModal,
                        editMode: false,
                        editingFields: {},
                        fieldEdits: {}
                      });
                      // Reset all image previews to their original values
                      if (itemDetailModal.collection?.fields && itemDetailModal.itemDetails) {
                        const imageFields = itemDetailModal.collection.fields.filter(field => field.type === 'Image');
                        const initialPreviews: {[fieldSlug: string]: string | null} = {};
                        imageFields.forEach(field => {
                          const itemKey = findMatchingKey(field.slug, itemDetailModal.itemDetails);
                          const value = itemDetailModal.itemDetails[itemKey];
                          const imgUrl = typeof value === 'object' ? value.url : value;
                          initialPreviews[field.slug] = imgUrl || null;
                        });
                        setImagePreviewUrls(initialPreviews);
                      }
                    }}
                  >
                    Cancel
                  </CancelButton>
                )}
              </div>
              <div>
                {itemDetailModal.editMode ? (
                  <SaveButton 
                    onClick={async () => {
                      if (!itemDetailModal.collection || !itemDetailModal.item || !selectedProject?.token || !itemDetailModal.collection.fields) return;
                      setItemDetailModal(prev => ({ ...prev, isSaving: true }));
                      try {
                        // Prepare updated field edits, including image fields
                        const imageFields = itemDetailModal.collection.fields.filter(field => field.type === 'Image');
                        const updatedFieldEdits = { ...itemDetailModal.fieldEdits };
                        imageFields.forEach(field => {
                          const previewUrl = imagePreviewUrls[field.slug];
                          const currentEdit = updatedFieldEdits[field.slug];
                          if (previewUrl) {
                            if (!currentEdit || (typeof currentEdit === 'object' && currentEdit.url !== previewUrl)) {
                              updatedFieldEdits[field.slug] = {
                                url: previewUrl,
                                fileName: typeof currentEdit === 'object' ? currentEdit.fileName || 'image' : 'image',
                                fileSize: typeof currentEdit === 'object' ? currentEdit.fileSize : 0,
                                fileType: typeof currentEdit === 'object' ? currentEdit.fileType : 'image/jpeg',
                              };
                            }
                          } else if (previewUrl === null) {
                            updatedFieldEdits[field.slug] = null;
                          }
                        });

                        // Log the activity
                        if (selectedProject?.id && itemDetailModal.item) {
                          const itemId = itemDetailModal.item.id || itemDetailModal.item._id;
                          const itemName = 
                            itemDetailModal.item.name || 
                            itemDetailModal.item.title || 
                            `Item ${itemId.substring(0, 8)}`;
                          
                          await recordActivity(
                            selectedProject.id,
                            'edit_cms_item',
                            'cms_item',
                            itemId,
                            itemDetailModal.itemDetails, // Previous data
                            { 
                              ...itemDetailModal.itemDetails, 
                              ...updatedFieldEdits,
                              _collection_id: itemDetailModal.collection.id,
                              _collection_name: itemDetailModal.collection.name 
                            } // New data with updates
                          );
                        }

                        // Call Webflow API to update the item
                        await webflowAPI.updateCollectionItem(
                          itemDetailModal.collection.id,
                          itemDetailModal.item.id || itemDetailModal.item._id,
                          { fieldData: updatedFieldEdits },
                          selectedProject.token
                        );
                        // Fetch updated item details
                        await fetchItemDetails(itemDetailModal.collection, itemDetailModal.item);
                        setItemDetailModal(prev => ({ ...prev, editMode: false, editingFields: {}, isSaving: false }));
                      } catch (err) {
                        setItemDetailModal(prev => ({ ...prev, isSaving: false }));
                        alert('Failed to update item: ' + ((err as any)?.message || String(err)));
                      }
                    }}
                    disabled={itemDetailModal.isSaving}
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      padding: '0.5rem 1.5rem',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}
                  >
                    {itemDetailModal.isSaving ? 'Saving...' : 'Save All Changes'}
                  </SaveButton>
                ) : (
                  <ImportedActionButton onClick={closeItemDetailModal}>Close</ImportedActionButton>
                )}
              </div>
            </ItemDetailModalFooterStyled>
          </ItemDetailModalWrapper>
        </ModalOverlay>
      )}
    </CmsEditorContainer>
  );
};

export default CMSEditor;