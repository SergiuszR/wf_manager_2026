import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { format, addMinutes, addHours, addDays } from 'date-fns';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useProjectContext } from '../contexts/ProjectContext';
import {
  ModalOverlay,
  ModalHeader as WFModalHeader,
  ModalTitle as WFModalTitle,
  CloseButton as WFCloseButton,
  ModalBody as WFModalBody,
  ModalFooter as WFModalFooter,
  LoadingContainer,
  LoadingText,
  ErrorContainer,
  ModalDescription,
  ModalActions,
} from './ui/WebflowStyledComponents';
import { webflowAPI } from '../api/apiClient';
import { recordActivity } from '../services/activityLogService';

interface NavItemProps {
  $active?: boolean;
}

interface PublishState {
  isOpen: boolean;
  isScheduling: boolean;
  scheduledTime: string;
  selectedSiteId: string;
  selectedSiteName: string;
  sites: Array<{ id: string, name: string }>;
  isPublishing: boolean;
  isSuccess: boolean;
  error: string | null;
  scheduledPublishes: Record<string, string>; // Map of siteId to scheduled time
}

// Before the component definition, add a key for localStorage
const SCHEDULED_PUBLISHES_KEY = 'scheduledPublishes'; // Revert to original key

// Extend the User type locally to include webflowToken
interface UserWithWebflowToken extends SupabaseUser {
  webflowToken?: string;
  tokenName?: string;
}

const Layout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const navigate = useNavigate();
  const { user: rawUser, logout, token } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [publishState, setPublishState] = useState<PublishState>({
    isOpen: false,
    isScheduling: false,
    scheduledTime: '',
    selectedSiteId: '',
    selectedSiteName: '',
    sites: [],
    isPublishing: false,
    isSuccess: false,
    error: null,
    scheduledPublishes: {}
  });
  const { projects, selectedProject, setSelectedProject, refreshProjects, loading: projectsLoading } = useProjectContext();

  // Extend the User type locally to include webflowToken
  const user = rawUser as UserWithWebflowToken | null;

  // Fetch sites for the publish modal and scheduled indicators and set up periodic check for expirations
  useEffect(() => {
    // Separate function to fetch sites
    const fetchSites = async () => {
      if (!token || !user?.webflowToken) return;
      try {
        const response = await webflowAPI.getSites(user.webflowToken);
        if (response.data && Array.isArray(response.data.sites)) {
          const sites = response.data.sites.map((site: any) => ({
            id: site.id,
            name: site.name
          }));
          setPublishState(prev => ({
            ...prev,
            sites
          }));
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
      }
    };
    fetchSites();
    const siteInterval = setInterval(fetchSites, 120000); // Every 2 minutes
    return () => {
      clearInterval(siteInterval);
    };
  }, [token, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Modified openPublishModal to check for selectedProject
  const openPublishModal = async () => {
    console.log('[PublishModal] Clicked Publish Site button');
    if (!selectedProject) {
      console.log('[PublishModal] No project selected');
      alert('Select a project to continue.');
      return;
    }
    if (!token) {
      console.log('[PublishModal] No token');
      return;
    }
    if (!selectedProject.token) {
      console.log('[PublishModal] No selectedProject.token');
      alert('Selected project does not have a Webflow token.');
      return;
    }
    try {
      console.log('[PublishModal] Fetching sites...');
      const response = await webflowAPI.getSites(selectedProject.token);
      const sites = response.data.sites || [];
      if (sites.length > 0) {
        // Only use the first site, as each token is for one site
        const site = sites[0];
        console.log('[PublishModal] Single site found, opening modal');
        setPublishState(prev => ({
          ...prev,
          isOpen: true,
          sites: [site],
          selectedSiteId: site.id,
          selectedSiteName: site.name
        }));
      } else {
        console.log('[PublishModal] No sites found for this token');
        setPublishState(prev => ({
          ...prev,
          isOpen: true,
          error: 'No sites found for this token'
        }));
      }
    } catch (err: any) {
      console.log('[PublishModal] Error fetching sites', err);
      setPublishState(prev => ({
        ...prev,
        isOpen: true,
        error: err.response?.data?.message || 'Failed to fetch sites'
      }));
    }
  };

  // Handle closing the publish modal
  const closePublishModal = () => {
    setPublishState({
      ...publishState,
      isOpen: false,
      isSuccess: false,
      error: null
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

  // Handle publishing the site
  const handlePublish = async () => {
    if (!publishState.selectedSiteId) {
      setPublishState({
        ...publishState,
        error: 'Please select a site to publish'
      });
      return;
    }
    if (!token || !selectedProject?.token) {
      setPublishState({
        ...publishState,
        error: 'You must provide a Webflow token to publish.'
      });
      return;
    }
    setPublishState({
      ...publishState,
      isPublishing: true,
      error: null
    });
    try {
      const scheduledTime = publishState.isScheduling && publishState.scheduledTime 
        ? new Date(publishState.scheduledTime).toISOString() 
        : undefined;
      
      const response = await webflowAPI.publishSite(
        publishState.selectedSiteId,
        scheduledTime,
        selectedProject.token
      );
      
      if (publishState.isScheduling && publishState.scheduledTime) {
        const updatedSchedules = {
          ...publishState.scheduledPublishes,
          [publishState.selectedSiteId]: publishState.scheduledTime
        };
        localStorage.setItem(SCHEDULED_PUBLISHES_KEY, JSON.stringify(updatedSchedules));
        refreshScheduledPublishes();
        setPublishState(prev => ({
          ...prev,
          isPublishing: false,
          isSuccess: true,
          error: null
        }));
        showToast('Publication scheduled successfully!', 'success');
        // Log activity
        recordActivity(
          selectedProject.id,
          'publish_site',
          'site',
          publishState.selectedSiteId,
          null,
          {
            scheduledTime: publishState.scheduledTime,
            siteName: publishState.selectedSiteName,
            type: 'scheduled'
          }
        );
      } else {
        setPublishState({
          ...publishState,
          isPublishing: false,
          isSuccess: true,
          error: null
        });
        showToast('Site published successfully!', 'success');
        // Log activity
        recordActivity(
          selectedProject.id,
          'publish_site',
          'site',
          publishState.selectedSiteId,
          null,
          {
            siteName: publishState.selectedSiteName,
            type: 'immediate'
          }
        );
      }
      setTimeout(() => {
        closePublishModal();
      }, 3000);
    } catch (err: any) {
      let errorMessage = 'Error publishing site';
      if (err.response) {
        if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data?.error?.message) {
          errorMessage = err.response.data.error.message;
        }
      }
      setPublishState({
        ...publishState,
        isPublishing: false,
        error: errorMessage
      });
      showToast(errorMessage, 'error');
    }
  };

  // Add a function to calculate relative time for human-readable display
  const getRelativeTimeString = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  // Render the publish modal
  const renderPublishModal = () => {
    if (!publishState.isOpen) return null;
    
    const scheduledDate = publishState.scheduledTime 
      ? new Date(publishState.scheduledTime) 
      : null;
    
    const relativeTime = scheduledDate 
      ? getRelativeTimeString(scheduledDate) 
      : '';

    return (
      <Modal onClick={closePublishModal}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <h2>Publish Site</h2>
            <WFCloseButton onClick={closePublishModal}>×</WFCloseButton>
          </ModalHeader>
          
          {publishState.isSuccess ? (
            <SuccessMessage>
              <span role="img" aria-label="Success">✅</span>
              {publishState.isScheduling 
                ? `Publication scheduled for ${formatScheduledTime(publishState.scheduledTime)}`
                : 'Site published successfully!'}
            </SuccessMessage>
          ) : (
            <>
              <ModalBody>
                {publishState.error && (
                  <ErrorMessage>
                    <strong>Error:</strong> {publishState.error}
                    {publishState.error.includes('Too many requests') && (
                      <p>Webflow API has rate limits. Please wait a moment and try again.</p>
                    )}
                  </ErrorMessage>
                )}
                
                <ScheduleToggle>
                  <Label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ToggleSwitch>
                      <input
                        type="checkbox"
                        checked={publishState.isScheduling}
                        onChange={toggleScheduling}
                      />
                      <Slider />
                    </ToggleSwitch>
                    <span>Schedule for later</span>
                  </Label>
                </ScheduleToggle>
                
                {publishState.isScheduling && (
                  <ScheduleContainer>
                    <FormGroup>
                      <Label>Publish Time:</Label>
                      <DateTimeInput
                        type="datetime-local"
                        value={publishState.scheduledTime}
                        onChange={handleScheduledTimeChange}
                        min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                      />
                      {scheduledDate && (
                        <ScheduleSummary>
                          {formatScheduledTime(publishState.scheduledTime)} ({relativeTime})
                        </ScheduleSummary>
                      )}
                    </FormGroup>
                    
                    <QuickOptions>
                      <Label>Quick Options:</Label>
                      <QuickOptionsButtons>
                        <QuickButton 
                          onClick={() => setQuickTime(15)}
                        >
                          15 min
                        </QuickButton>
                        <QuickButton 
                          onClick={() => setQuickTime(30)}
                        >
                          30 min
                        </QuickButton>
                        <QuickButton 
                          onClick={() => setQuickTime(60)}
                        >
                          1 hour
                        </QuickButton>
                        <QuickButton 
                          onClick={() => setQuickTime(24 * 60)}
                        >
                          Tomorrow
                        </QuickButton>
                      </QuickOptionsButtons>
                    </QuickOptions>
                  </ScheduleContainer>
                )}
                
                <PublishNote>
                  {publishState.isScheduling 
                    ? 'This will schedule the publication of your site at the specified time.' 
                    : 'This will publish your site immediately.'}
                </PublishNote>
              </ModalBody>
              
              <ModalFooter>
                <Button onClick={closePublishModal}>
                  Cancel
                </Button>
                <Button className="primary" 
                  onClick={handlePublish}
                >
                  {publishState.isPublishing ? (
                    <Spinner />
                  ) : publishState.isScheduling ? (
                    'Schedule Publish'
                  ) : (
                    'Publish Now'
                  )}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    );
  };

  const cancelScheduledPublish = (siteId: string) => {
    // Remove the scheduled publish from state and localStorage
    console.log(`Cancelling scheduled publish for site ${siteId}`);
    
    // Get current schedules and remove the specified one
    try {
      const savedSchedules = localStorage.getItem(SCHEDULED_PUBLISHES_KEY);
      if (savedSchedules) {
        const parsedSchedules = JSON.parse(savedSchedules);
        delete parsedSchedules[siteId];
        
        // Save updated schedules back to localStorage
        localStorage.setItem(SCHEDULED_PUBLISHES_KEY, JSON.stringify(parsedSchedules));
        console.log('Updated schedules after cancellation:', parsedSchedules);
        
        // Refresh the state from localStorage
        refreshScheduledPublishes();
      }
    } catch (err) {
      console.error('Error cancelling scheduled publish:', err);
    }
  };

  // Format the date for display
  const formatScheduledTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (err) {
      console.error('Error formatting date:', err, isoString);
      return isoString;
    }
  };

  // Add a function to force a refresh of scheduled publishes
  const refreshScheduledPublishes = useCallback(() => {
    try {
      const savedSchedules = localStorage.getItem(SCHEDULED_PUBLISHES_KEY);
      if (savedSchedules) {
        const parsedSchedules = JSON.parse(savedSchedules);
        const now = new Date();
        const filteredSchedules: Record<string, string> = {};
        
        Object.entries(parsedSchedules).forEach(([siteId, value]) => {
          const scheduledTime = value as string;
          
          try {
            const scheduleDate = new Date(scheduledTime);
            if (!isNaN(scheduleDate.getTime()) && scheduleDate > now) {
              filteredSchedules[siteId] = scheduledTime;
            }
          } catch (e) {
            console.error(`Invalid date format for site ${siteId}:`, scheduledTime);
          }
        });
        
        console.log('refreshScheduledPublishes - filtered schedules:', filteredSchedules);
        setPublishState(prev => ({
          ...prev,
          scheduledPublishes: filteredSchedules
        }));
      }
    } catch (err) {
      console.error('Error refreshing scheduled publishes:', err);
    }
  }, []);
  
  // Call refresh function when component mounts
  useEffect(() => {
    refreshScheduledPublishes();
    // Set up interval to check periodically
    const interval = setInterval(refreshScheduledPublishes, 10000);
    return () => clearInterval(interval);
  }, [refreshScheduledPublishes]);

  // Debug component to help troubleshoot scheduled publishes
  const ScheduledPublishesDebug = () => {
    const [localStorageData, setLocalStorageData] = useState<string>('');
    
    useEffect(() => {
      const checkStorage = () => {
        const data = localStorage.getItem(SCHEDULED_PUBLISHES_KEY) || '';
        setLocalStorageData(data);
      };
      
      checkStorage();
      const interval = setInterval(checkStorage, 5000);
      
      return () => clearInterval(interval);
    }, []);
    
    // Skip in production
    const isProduction = window.location.hostname !== 'localhost';
    if (isProduction) {
      return null;
    }
    
    const loadFromLocalStorage = () => {
      refreshScheduledPublishes();
    };
    
    return (
      <DebugContainer>
        <h4>Scheduled Publishes Debug</h4>
        <p>From State: {JSON.stringify(publishState.scheduledPublishes)}</p>
        <p>From localStorage: {localStorageData}</p>
        <button onClick={loadFromLocalStorage}>
          Reload From localStorage
        </button>
        <button onClick={() => {
          const now = new Date();
          const testData = {
            'test-site-id': new Date(now.getTime() + 3600000).toISOString()
          };
          localStorage.setItem(SCHEDULED_PUBLISHES_KEY, JSON.stringify(testData));
          setPublishState(prev => ({
            ...prev,
            scheduledPublishes: testData
          }));
        }}>
          Add Test Data
        </button>
        <button onClick={() => {
          localStorage.removeItem(SCHEDULED_PUBLISHES_KEY);
          setPublishState(prev => ({
            ...prev,
            scheduledPublishes: {}
          }));
        }}>
          Clear Data
        </button>
      </DebugContainer>
    );
  };

  // Project Picker Modal (refactored)
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [tempSelected, setTempSelected] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectToken, setNewProjectToken] = useState('');
  const [newProjectLoading, setNewProjectLoading] = useState(false);
  const [newProjectError, setNewProjectError] = useState('');
  useEffect(() => {
    if (!selectedProject) setShowProjectPicker(true);
    else setShowProjectPicker(false);
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) setTempSelected(selectedProject.id);
    else setTempSelected(null);
  }, [selectedProject]);

  const handleProjectPick = (projectId: string) => {
    setTempSelected(projectId);
  };
  const handleContinue = () => {
    if (tempSelected) {
      const proj = projects.find(p => String(p.id) === tempSelected);
      if (proj) setSelectedProject(proj);
    }
  };
  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewProjectError('');
    if (!newProjectName || !newProjectToken) {
      setNewProjectError('Please provide both a name and a token');
      return;
    }
    if (newProjectToken.length < 30) {
      setNewProjectError('Invalid token format. Webflow API tokens are typically longer than 30 characters.');
      return;
    }
    setNewProjectLoading(true);
    try {
      const { data, error } = await import('../lib/supabaseClient').then(m => m.supabase.from('projects').insert([{ name: newProjectName, token: newProjectToken, user_id: user?.id }]).select());
      if (error) setNewProjectError(error.message);
      else {
        setNewProjectName('');
        setNewProjectToken('');
        await refreshProjects();
        if (data && data[0]) setSelectedProject(data[0]);
        setShowNewProjectModal(false);
        setShowProjectPicker(false);
      }
    } catch (err: any) {
      setNewProjectError(err.message || 'Failed to add project');
    }
    setNewProjectLoading(false);
  };

  const ProjectPickerModal = () => (
    <ModalOverlay>
      <ModalContent style={{ maxWidth: 420, minWidth: 340, width: '90vw' }}>
        <ModalHeader>
          <ModalTitle>Select a Project</ModalTitle>
          <WFCloseButton onClick={() => setShowProjectPicker(false)} aria-label="Close">×</WFCloseButton>
        </ModalHeader>
        <ModalBody>
          <ModalDescription>Choose which Webflow project you want to manage.</ModalDescription>
          {projectsLoading ? (
            <LoadingContainer>
              <Spinner />
              <LoadingText>Loading projects...</LoadingText>
            </LoadingContainer>
          ) : projects.length === 0 ? (
            <ErrorContainer>
              <span style={{ fontSize: '2rem', marginBottom: 8 }}>📂</span>
              <div>No projects found. Please add a project below.</div>
            </ErrorContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {projects.map((p) => {
                const checked = tempSelected === String(p.id);
                return (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '0.85rem 1.1rem',
                      borderRadius: 10, border: checked ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: checked ? 'var(--hover-color)' : 'var(--background-main)',
                      cursor: 'pointer',
                      fontWeight: checked ? 600 : 500,
                      color: checked ? 'var(--primary-color)' : 'var(--text-primary)',
                      transition: 'all 0.15s',
                      boxShadow: checked ? '0 0 0 2px var(--primary-color-light, #b3d4fc)' : 'none',
                    }}
                  >
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%', background: 'var(--secondary-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary-color)'
                    }}>{p.name?.[0]?.toUpperCase() || '?'}</span>
                    <input
                      type="radio"
                      name="project"
                      checked={checked}
                      onChange={() => handleProjectPick(String(p.id))}
                      style={{ accentColor: 'var(--primary-color)', width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
                    {checked && <span style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '1.2em' }}>✓</span>}
                  </label>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            onClick={handleContinue}
            disabled={!tempSelected}
            style={{
              background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '0.75rem 0', fontWeight: 600, fontSize: '1.1rem', cursor: tempSelected ? 'pointer' : 'not-allowed',
              opacity: tempSelected ? 1 : 0.6, transition: 'opacity 0.15s',
              marginRight: 8, minWidth: 120
            }}
          >
            Continue
          </button>
          <button
            onClick={() => setShowNewProjectModal(true)}
            style={{
              background: 'var(--secondary-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: 8,
              padding: '0.75rem 0', fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer',
              minWidth: 120
            }}
          >
            + New Project
          </button>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );

  // Mini modal rendered at top level
  const NewProjectMiniModal = showNewProjectModal && (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.22)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <form
        onSubmit={handleNewProject}
        style={{
          background: 'var(--background-light)', borderRadius: 16, boxShadow: 'var(--box-shadow)',
          minWidth: 320, maxWidth: 400, width: '90vw', padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          gap: 18,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary-color)', marginBottom: 2 }}>Add New Project</div>
        <input
          type="text"
          placeholder="Project Name"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          style={{ 
            padding: '0.75rem', 
            borderRadius: 7, 
            border: '1px solid var(--border-color)', 
            fontSize: '1rem', 
            marginBottom: 2,
            backgroundColor: 'var(--background-light)',
            color: 'var(--text-primary)'
          }}
          required
        />
        <input
          type="text"
          placeholder="Webflow Token"
          value={newProjectToken}
          onChange={e => setNewProjectToken(e.target.value)}
          style={{ 
            padding: '0.75rem', 
            borderRadius: 7, 
            border: '1px solid var(--border-color)', 
            fontSize: '1rem', 
            marginBottom: 2,
            backgroundColor: 'var(--background-light)',
            color: 'var(--text-primary)'
          }}
          required
        />
        {newProjectError && <div style={{ color: 'var(--error-color)', fontWeight: 500, marginBottom: 2 }}>{newProjectError}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowNewProjectModal(false)}
            style={{ 
              flex: 1, 
              background: 'var(--secondary-color)', 
              color: 'var(--primary-color)', 
              border: '1px solid var(--primary-color)', 
              borderRadius: 7, 
              padding: '0.7rem 0', 
              fontWeight: 600, 
              fontSize: '1rem', 
              cursor: 'pointer' 
            }}
            disabled={newProjectLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ flex: 1, background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 7, padding: '0.7rem 0', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', opacity: newProjectLoading ? 0.7 : 1 }}
            disabled={newProjectLoading}
          >
            {newProjectLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );

  // Toast notification state and component
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <AppContainer>
      {showProjectPicker && <ProjectPickerModal />}
      {NewProjectMiniModal}
      <Sidebar>
        <SidebarHeader>
          <Logo>Webflow Manager</Logo>
        </SidebarHeader>
        <Nav>
          <NavItem $active={isActive('/dashboard')}>
            <StyledLink to="/dashboard">Dashboard</StyledLink>
          </NavItem>
          <NavItem $active={isActive('/pages')}>
            {selectedProject ? (
              <StyledLink to="/pages">Pages</StyledLink>
            ) : (
              <DisabledNavItem title="Select a project to continue.">Pages</DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/cms-editor')}>
            {selectedProject ? (
              <StyledLink to="/cms-editor">CMS Editor</StyledLink>
            ) : (
              <DisabledNavItem title="Select a project to continue.">CMS Editor</DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/assets')}>
            {user?.user_metadata?.premium ? (
              selectedProject ? (
                <StyledLink to="/assets">Assets</StyledLink>
              ) : (
                <DisabledNavItem title="Select a project to continue.">Assets</DisabledNavItem>
              )
            ) : (
              <DisabledNavItem>Assets <PremiumBadge>Premium</PremiumBadge></DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/activity')}>
            {user?.user_metadata?.premium ? (
              selectedProject ? (
                <StyledLink to="/activity">Activity Logs</StyledLink>
              ) : (
                <DisabledNavItem title="Select a project to continue.">Activity Logs</DisabledNavItem>
              )
            ) : (
              <DisabledNavItem>Activity Logs <PremiumBadge>Premium</PremiumBadge></DisabledNavItem>
            )}
          </NavItem>
          <ActionButton
            onClick={selectedProject ? openPublishModal : undefined}
            title={!selectedProject ? 'Select a project to continue.' : undefined}
            style={!selectedProject ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <ActionIcon>🚀</ActionIcon>
            <ActionText>Publish Site</ActionText>
          </ActionButton>
          
          {/* Scheduled Publishes Indicator - only show if there are scheduled publishes */}
          {Object.keys(publishState.scheduledPublishes).length > 0 && (
            <ScheduledPublishesContainer $hasScheduledPublishes={true}>
              <ScheduledPublishesTitle $hasScheduledPublishes={true}>
                Scheduled Publishes ({Object.keys(publishState.scheduledPublishes).length})
              </ScheduledPublishesTitle>
              {Object.entries(publishState.scheduledPublishes).map(([siteId, scheduledTime]) => {
                const siteName = publishState.sites.find(s => s.id === siteId)?.name || siteId;
                return (
                  <ScheduledPublishItem key={siteId}>
                    <ScheduledPublishInfo>
                      <span>{siteName}</span>
                      <span>{formatScheduledTime(scheduledTime)}</span>
                    </ScheduledPublishInfo>
                    <CancelScheduleButton onClick={() => cancelScheduledPublish(siteId)}>
                      ×
                    </CancelScheduleButton>
                  </ScheduledPublishItem>
                );
              })}
            </ScheduledPublishesContainer>
          )}
        </Nav>
        <UserSection>
          {user && (
            <>
              <UserInfo>
                <TokenName>Active Webflow Token</TokenName>
                <TokenLabel>{user.tokenName}</TokenLabel>
              </UserInfo>
              <ButtonGroup>
                <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
                <ThemeButton 
                  onClick={toggleTheme} 
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? '🌙' : '☀️'}
                </ThemeButton>
              </ButtonGroup>
            </>
          )}
        </UserSection>
        
        {/* Add debug panel at the bottom of sidebar in development */}
        {window.location.hostname === 'localhost' && <ScheduledPublishesDebug />}
      </Sidebar>
      <MainContent>
        {children}
      </MainContent>
      {renderPublishModal()}
      {toast && (
        <ToastContainer $type={toast.type}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </ToastContainer>
      )}
    </AppContainer>
  );
};

const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: var(--background-main);
`;

const Sidebar = styled.div`
  width: 250px;
  background-color: var(--background-light);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  box-shadow: var(--box-shadow);
`;

const SidebarHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
`;

const Logo = styled.h1`
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--primary-color);
`;

const Nav = styled.nav`
  flex: 1;
  padding: 1.5rem 0;
`;

const NavItem = styled.div<NavItemProps>`
  padding: 0.75rem 1.5rem;
  position: relative;
  
  ${props => props.$active && `
    background-color: var(--hover-color);
    border-left: 4px solid var(--primary-color);
    padding-left: calc(1.5rem - 4px);
    
    a {
      color: var(--primary-color);
      font-weight: 600;
    }
  `}
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

const StyledLink = styled(Link)`
  color: var(--text-secondary);
  text-decoration: none;
  display: block;
  
  &:hover {
    text-decoration: none;
    color: var(--primary-color);
  }
`;

const UserSection = styled.div`
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
`;

const UserInfo = styled.div`
  margin-bottom: 1rem;
`;

const TokenName = styled.div`
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--primary-color);
  margin-bottom: 0.25rem;
`;

const TokenLabel = styled.div`
  font-size: 0.75rem;
  color: var(--text-secondary);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const LogoutButton = styled.button`
  flex: 1;
  padding: 0.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.875rem;
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
`;

const ThemeButton = styled.button`
  padding: 0.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding: 2rem;
  margin-left: 250px;
  width: calc(100% - 250px);
`;

// New styled components for publish feature
const ActionButton = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  margin: 1rem 0;
  border-radius: 4px;
  background-color: var(--primary-color);
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  margin: 1.5rem;
  
  &:hover {
    background-color: var(--primary-hover);
  }
`;

const ActionIcon = styled.span`
  margin-right: 8px;
  font-size: 1rem;
`;

const ActionText = styled.span`
  font-weight: 500;
  font-size: 0.875rem;
`;

// Modal components
const Modal = styled.div`
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
  width: 95%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease-out;
  padding: 0.5rem 0.5rem 1.5rem 0.5rem;
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
  max-height: 60vh;
  overflow-y: auto;
`;

const ModalFooter = styled.div`
  padding: 1.25rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--hover-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  &.primary {
    background-color: var(--primary-color);
    color: white;
    border: none;
  }
  &.primary:hover {
    background-color: var(--primary-hover);
    color: white;
    border: none;
  }
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
  background-color: var(--hover-color);
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  input {
    width: -webkit-fill-available;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--background-light);
    color: var(--text-primary);
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
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

const SuccessMessage = styled.div`
  padding: 15px;
  background-color: rgba(46, 125, 50, 0.1);
  color: #2e7d32;
  border-radius: 4px;
  text-align: center;
  font-weight: 500;
`;

const ErrorMessage = styled.div`
  padding: 15px;
  background-color: rgba(229, 62, 62, 0.1);
  color: var(--error-color);
  border-radius: 4px;
  margin-top: 15px;
`;

// New styled components for scheduled publishes
interface ScheduledPublishesProps {
  $hasScheduledPublishes: boolean;
}

const ScheduledPublishesContainer = styled.div<ScheduledPublishesProps>`
  margin: 1.5rem;
  padding: 1rem;
  background-color: var(--background-main);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  min-height: 100px;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
  
  &:before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 16px;
    background-color: var(--primary-color);
    border-radius: 50%;
    animation: pulse 2s infinite;
    opacity: ${props => props.$hasScheduledPublishes ? 1 : 0};
    transition: opacity 0.3s ease;
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(var(--primary-rgb), 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0);
    }
  }
`;

const ScheduledPublishesTitle = styled.h3<ScheduledPublishesProps>`
  font-size: 0.9rem;
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--primary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:after {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${props => props.$hasScheduledPublishes ? 'var(--success-color)' : 'transparent'};
    transition: background-color 0.3s ease;
  }
`;

const ScheduledPublishItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  border-bottom: 1px dashed var(--border-color);
  
  &:last-child {
    border-bottom: none;
  }
`;

const ScheduledPublishInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  
  span:first-child {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  span:last-child {
    font-size: 0.75rem;
    opacity: 0.8;
  }
`;

const CancelScheduleButton = styled.button`
  background: transparent;
  border: none;
  color: var(--error-color);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 50%;
  
  &:hover {
    background-color: rgba(229, 62, 62, 0.1);
  }
`;

// Add styled components for the new UI elements
const ScheduleSummary = styled.div`
  font-size: 0.8rem;
  margin-top: 0.25rem;
  color: var(--text-secondary);
`;

const PublishNote = styled.div`
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: rgba(var(--primary-rgb), 0.1);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  color: var(--text-secondary);
`;

const Spinner = styled.div`
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

// Add these styled components
const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-secondary);
  color: var(--text-primary);
`;

const DateTimeInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--background-secondary);
  color: var(--text-primary);
`;

const QuickOptions = styled.div`
  margin-top: 1rem;
`;

const QuickOptionsButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
`;

const QuickButton = styled.button`
  padding: 0.5rem;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  cursor: pointer;
  
  &:hover {
    background-color: var(--background-hover);
  }
`;

// Debug styled components
const DebugContainer = styled.div`
  margin-top: auto;
  padding: 1rem;
  font-size: 0.75rem;
  background-color: rgba(255, 0, 0, 0.1);
  border-top: 1px solid rgba(255, 0, 0, 0.2);
  
  h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
  
  p {
    margin: 0.25rem 0;
    word-break: break-all;
    white-space: normal;
  }
  
  button {
    margin-right: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
`;

// New styled component for empty state
const EmptyScheduleMessage = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0.5rem 0;
  font-style: italic;
  text-align: center;
`;

// Add styled components for the badge and disabled nav item
const PremiumBadge = styled.span`
  background: gold;
  color: #fff;
  font-size: 0.7em;
  font-weight: bold;
  border-radius: 8px;
  padding: 0.1em 0.6em;
  margin-left: 0.5em;
  vertical-align: middle;
`;

const DisabledNavItem = styled.span`
  color: var(--text-tertiary);
  opacity: 0.6;
  cursor: not-allowed;
  display: inline-block;
  padding: 0.5em 0;
`;

// Add styled ToastContainer
const ToastContainer = styled.div<{ $type: 'success' | 'error' }>`
  position: fixed;
  top: 32px;
  right: 32px;
  z-index: 9999;
  background: ${({ $type }) => $type === 'success' ? 'rgba(46, 204, 113, 0.95)' : 'rgba(231, 76, 60, 0.95)'};
  color: #fff;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  animation: toastIn 0.3s cubic-bezier(0.4,0,0.2,1);
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// Add ToggleSwitch styled component
const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
`;
const Slider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 24px;
  transition: .4s;
  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: .4s;
  }
  input:checked + & {
    background-color: var(--primary-color);
  }
  input:checked + &:before {
    transform: translateX(20px);
  }
`;

export default Layout; 