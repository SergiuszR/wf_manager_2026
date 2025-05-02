import styled from 'styled-components';
import { ItemCountsProps, ItemCountBadgeProps, ItemCountLabelProps, ColumnToggleButtonProps } from '../../types/webflow';

// Create a component for action button
export const ActionButton = styled.button`
  margin-left: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  
  &:hover {
    background-color: var(--hover-color);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

// Create a component for modal overlay
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
`;

// Create a component for modal content
export const ModalContent = styled.div`
  background-color: var(--background-main);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
`;

// Create a component for modal header
export const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background-color: var(--background-light);
  border-bottom: 1px solid var(--border-color);
`;

// Create a component for modal title
export const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
`;

// Create a component for close button
export const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
  
  &:hover {
    color: var(--text-primary);
  }
`;

// Create a component for modal body
export const ModalBody = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

// Create a component for modal footer
export const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  background-color: var(--background-light);
  border-top: 1px solid var(--border-color);
`;

// Create a component for loading container
export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  min-height: 300px;
`;

// Create a component for loading text
export const LoadingText = styled.p`
  margin-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

// Create a component for error container
export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  min-height: 300px;
  color: var(--error-color);
`;

// Create a component for error icon
export const ErrorIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 1rem;
`;

// Create a component for modal description
export const ModalDescription = styled.p`
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
`;

// Create a component for modal actions
export const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

// Create a component for items table
export const ItemsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

// Create a component for items table header
export const ItemsTableHeader = styled.th`
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

// Create a component for items table row
export const ItemsTableRow = styled.tr`
  &:nth-child(even) {
    background-color: var(--background-light);
  }
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

// Create a component for items table cell
export const ItemsTableCell = styled.td`
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-color);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Create a component for column toggle button
export const ColumnToggleButton = styled.button<ColumnToggleButtonProps>`
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

// Create a component for item status badge
export const ItemStatusBadge = styled.span<{ $status: string }>`
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

// Create a component for items count
export const ItemsCount = styled.div`
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

// Create a component for column toggle container
export const ColumnToggleContainer = styled.div`
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background-color: var(--background-light);
  border-radius: 8px;
  border: 1px solid var(--border-color);
`;

// Create a component for column toggle header
export const ColumnToggleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

// Create a component for column toggle label
export const ColumnToggleLabel = styled.div`
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
`;

// Create a component for column actions
export const ColumnActions = styled.div`
  display: flex;
  gap: 0.75rem;
`;

// Create a component for column toggle buttons
export const ColumnToggleButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

// Create a component for check icon
export const CheckIcon = styled.span`
  font-size: 0.8rem;
  font-weight: bold;
`;

// Create a component for items table wrapper
export const ItemsTableWrapper = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: white;
`;

// Create a component for items table container
export const ItemsTableContainer = styled.div`
  overflow-x: auto;
  max-height: 50vh;
`;

// Create a component for empty columns message
export const EmptyColumnsMessage = styled.div`
  text-align: center;
  padding: 3rem 0;
  color: var(--text-secondary);
  font-style: italic;
  background-color: var(--background-light);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
`;

// Create a component for detail link
export const DetailLink = styled.a`
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s;
  
  &:hover {
    color: var(--primary-hover);
  }
`;

// Create a component for edit modal content
export const EditModalContent = styled.div`
  background-color: var(--background-main);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
`;

// Create a component for edit modal header
export const EditModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background-color: var(--background-light);
  border-bottom: 1px solid var(--border-color);
`;

// Create a component for edit modal title
export const EditModalTitle = styled.div`
  display: flex;
  flex-direction: column;
  
  span {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
`;

// Create a component for edit modal subtitle
export const EditModalSubtitle = styled.div`
  font-size: 0.9rem;
  color: var(--text-secondary);
`;

// Create a component for edit modal body
export const EditModalBody = styled.div`
  padding: 1.5rem 2rem;
  overflow: auto;
  flex: 1;
`;

// Create a component for edit modal footer
export const EditModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  background-color: var(--background-light);
  border-top: 1px solid var(--border-color);
`;

// Top bar for dashboard actions
export const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

// Add button for dashboard
export const AddButton = styled.button`
  background: var(--primary-color);
  color: #fff;
  border: none;
  border-radius: var(--border-radius);
  padding: 0.7rem 1.2rem;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background 0.18s;
  &:hover {
    background: var(--primary-hover);
  }
`;

// Search bar container
export const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background: var(--background-light);
  border-radius: var(--border-radius);
  padding: 0.4rem 0.8rem;
  gap: 0.5rem;
`;

// Search input
export const SearchInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  font-size: 1rem;
  color: var(--text-primary);
`;

// Sort select dropdown
export const SortSelect = styled.select`
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background: var(--background-light);
  color: var(--text-primary);
  font-size: 1rem;
  padding: 0.4rem 1.2rem 0.4rem 0.7rem;
  font-weight: 500;
`;

// Star button for favorites
export const StarButton = styled.button<{ $active?: boolean }>`
  background: none;
  border: none;
  color: ${p => p.$active ? 'gold' : 'var(--border-color)'};
  font-size: 1.5rem;
  margin-right: 1rem;
  cursor: pointer;
  transition: color 0.18s;
  &:hover {
    color: gold;
  }
`; 