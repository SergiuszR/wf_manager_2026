export interface WebflowCollection {
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
  fields?: any[];
}

export interface WebflowCollectionItem {
  id: string;
  name: string;
  slug: string;
  updated: string;
  created: string;
  publishedOn?: string;
  status?: string;  // draft or published
  [key: string]: any; // Dynamic fields from the CMS
}

export interface ModalState {
  isOpen: boolean;
  collection: WebflowCollection | null;
  collectionDetails: any | null;
  error?: string;
}

export interface EditModalState {
  isOpen: boolean;
  collection: WebflowCollection | null;
  items: WebflowCollectionItem[];
  availableColumns: string[];
  visibleColumns: string[];
  isLoading: boolean;
  error?: string;
  stagedCount?: number;
  liveCount?: number;
}

export interface ItemDetailModalState {
  isOpen: boolean;
  collection: WebflowCollection | null;
  item: WebflowCollectionItem | null;
  itemDetails: any | null;
  isLoading: boolean;
  editMode: boolean;
  editingFields: Record<string, boolean>;
  fieldEdits: Record<string, any>;
  isSaving: boolean;
  error?: string;
  successMessage?: string;
}

export interface DropdownState {
  isOpen: boolean;
  collectionId: string | null;
}

export interface ItemCountsProps {
  $compact?: boolean;
}

export interface ItemCountBadgeProps {
  $small?: boolean;
  $live?: boolean;
  $draft?: boolean;
}

export interface ItemCountLabelProps {
  $small?: boolean;
}

export interface ColumnToggleButtonProps {
  $active?: boolean;
} 