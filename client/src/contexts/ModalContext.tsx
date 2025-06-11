import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ItemDetailModalState } from '../types/webflow';

interface ModalContextType {
  itemDetailModal: ItemDetailModalState;
  setItemDetailModal: React.Dispatch<React.SetStateAction<ItemDetailModalState>>;
  closeItemDetailModal: () => void;
}

const defaultModalState: ItemDetailModalState = {
  isOpen: false,
  collection: null,
  item: null,
  itemDetails: null,
  isLoading: false,
  editMode: false,
  editingFields: {},
  fieldEdits: {},
  isSaving: false,
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [itemDetailModal, setItemDetailModal] = useState<ItemDetailModalState>(defaultModalState);

  const closeItemDetailModal = () => {
    setItemDetailModal(defaultModalState);
  };

  return (
    <ModalContext.Provider value={{ itemDetailModal, setItemDetailModal, closeItemDetailModal }}>
      {children}
    </ModalContext.Provider>
  );
};

export function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used within a ModalProvider');
  return ctx;
} 