import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
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
import { PremiumUpgradeModal } from './PremiumUpgradeModal';

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
  
  // Premium upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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

  const handleUpgrade = async () => {
    if (!token) {
      setUpgradeError('Authentication required');
      return;
    }

    setUpgradeLoading(true);
    setUpgradeError(null);

    try {
      const response = await fetch('/api/auth/upgrade-premium', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upgrade failed');
      }

      // Redirect to Stripe checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
      
    } catch (error: any) {
      setUpgradeError(error.message || 'Failed to create checkout session');
      setUpgradeLoading(false);
    }
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
      <ModernModal onClick={closePublishModal}>
        <ModernModalContent onClick={(e) => e.stopPropagation()}>
          <ModernModalHeader>
            <ModernModalTitle>
              <ModernModalIcon>🚀</ModernModalIcon>
              <div>
                <ModernModalTitleText>Publish Site</ModernModalTitleText>
                <ModernModalSubtitle>Deploy your changes to the live site</ModernModalSubtitle>
              </div>
            </ModernModalTitle>
            <ModernCloseButton onClick={closePublishModal}>
              <span>×</span>
            </ModernCloseButton>
          </ModernModalHeader>
          
          {publishState.isSuccess ? (
            <ModernSuccessMessage>
              <div className="success-icon">✅</div>
              <div className="success-text">
                {publishState.isScheduling 
                  ? `Publication scheduled for ${formatScheduledTime(publishState.scheduledTime)}`
                  : 'Site published successfully!'}
              </div>
            </ModernSuccessMessage>
          ) : (
            <>
              <ModernModalBody>
                {publishState.error && (
                  <ModernErrorMessage>
                    <div className="error-icon">⚠️</div>
                    <div>
                      <strong>Error:</strong> {publishState.error}
                      {publishState.error.includes('Too many requests') && (
                        <p>Webflow API has rate limits. Please wait a moment and try again.</p>
                      )}
                    </div>
                  </ModernErrorMessage>
                )}
                
                <ModernScheduleToggle>
                  <ModernToggleLabel>
                    <input
                      type="checkbox"
                      checked={publishState.isScheduling}
                      onChange={toggleScheduling}
                    />
                    <ModernSlider />
                    <ModernToggleText>Schedule for later</ModernToggleText>
                  </ModernToggleLabel>
                </ModernScheduleToggle>
                
                {publishState.isScheduling && (
                  <ModernScheduleContainer>
                    <ModernFormGroup>
                      <ModernLabel>Publish Time</ModernLabel>
                      <ModernDateTimeInput
                        type="datetime-local"
                        value={publishState.scheduledTime}
                        onChange={handleScheduledTimeChange}
                        min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                      />
                      {scheduledDate && (
                        <ModernScheduleSummary>
                          {formatScheduledTime(publishState.scheduledTime)} ({relativeTime})
                        </ModernScheduleSummary>
                      )}
                    </ModernFormGroup>
                    
                    <ModernQuickOptions>
                      <ModernLabel>Quick Options</ModernLabel>
                      <ModernQuickOptionsButtons>
                        <ModernQuickButton onClick={() => setQuickTime(15)}>
                          15 min
                        </ModernQuickButton>
                        <ModernQuickButton onClick={() => setQuickTime(30)}>
                          30 min
                        </ModernQuickButton>
                        <ModernQuickButton onClick={() => setQuickTime(60)}>
                          1 hour
                        </ModernQuickButton>
                        <ModernQuickButton onClick={() => setQuickTime(24 * 60)}>
                          Tomorrow
                        </ModernQuickButton>
                      </ModernQuickOptionsButtons>
                    </ModernQuickOptions>
                  </ModernScheduleContainer>
                )}
                
                <ModernPublishNote>
                  {publishState.isScheduling 
                    ? 'Your site will be published automatically at the specified time.' 
                    : 'Your site will be published immediately and go live.'}
                </ModernPublishNote>
              </ModernModalBody>
              
              <ModernModalFooter>
                <ModernButton variant="secondary" onClick={closePublishModal}>
                  Cancel
                </ModernButton>
                <ModernButton variant="primary" onClick={handlePublish} disabled={publishState.isPublishing}>
                  {publishState.isPublishing ? (
                    <ModernSpinner />
                  ) : publishState.isScheduling ? (
                    'Schedule Publish'
                  ) : (
                    'Publish Now'
                  )}
                </ModernButton>
              </ModernModalFooter>
            </>
          )}
        </ModernModalContent>
      </ModernModal>
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
    // Only show project picker modal if there are multiple projects and no project is selected
    if (!selectedProject && projects.length > 1) {
      setShowProjectPicker(true);
    } else if (!selectedProject && projects.length === 1) {
      // Auto-select the only project available
      setSelectedProject(projects[0]);
      setShowProjectPicker(false);
    } else {
      setShowProjectPicker(false);
    }
  }, [selectedProject, projects, setSelectedProject]);

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
          <LogoContainer>
            <LogoIcon>⚡</LogoIcon>
            <Logo>Webflow Manager</Logo>
          </LogoContainer>
        </SidebarHeader>
        <Nav>
          <NavItem $active={isActive('/dashboard')}>
            <StyledLink to="/dashboard">
              <NavIcon>📊</NavIcon>
              <NavText>Dashboard</NavText>
            </StyledLink>
          </NavItem>
          <NavItem $active={isActive('/pages')}>
            {selectedProject ? (
              <StyledLink to="/pages">
                <NavIcon>📄</NavIcon>
                <NavText>Pages</NavText>
              </StyledLink>
            ) : (
              <DisabledNavItem title="Select a project to continue.">
                <NavIcon>📄</NavIcon>
                <NavText>Pages</NavText>
              </DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/cms-editor')}>
            {selectedProject ? (
              <StyledLink to="/cms-editor">
                <NavIcon>📝</NavIcon>
                <NavText>CMS Editor</NavText>
              </StyledLink>
            ) : (
              <DisabledNavItem title="Select a project to continue.">
                <NavIcon>📝</NavIcon>
                <NavText>CMS Editor</NavText>
              </DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/assets')}>
            {user?.user_metadata?.premium ? (
              selectedProject ? (
                <StyledLink to="/assets">
                  <NavIcon>🖼️</NavIcon>
                  <NavText>Assets</NavText>
                </StyledLink>
              ) : (
                <DisabledNavItem title="Select a project to continue.">
                  <NavIcon>🖼️</NavIcon>
                  <NavText>Assets</NavText>
                  <PremiumBadge>Premium</PremiumBadge>
                </DisabledNavItem>
              )
            ) : (
              <DisabledNavItem>
                <NavIcon>🖼️</NavIcon>
                <NavText>Assets</NavText>
                <PremiumBadge>Premium</PremiumBadge>
              </DisabledNavItem>
            )}
          </NavItem>
          <NavItem $active={isActive('/activity')}>
            {user?.user_metadata?.premium ? (
              selectedProject ? (
                <StyledLink to="/activity">
                  <NavIcon>📈</NavIcon>
                  <NavText>Activity Logs</NavText>
                </StyledLink>
              ) : (
                <DisabledNavItem title="Select a project to continue.">
                  <NavIcon>📈</NavIcon>
                  <NavText>Activity Logs</NavText>
                  <PremiumBadge>Premium</PremiumBadge>
                </DisabledNavItem>
              )
            ) : (
              <DisabledNavItem>
                <NavIcon>📈</NavIcon>
                <NavText>Activity Logs</NavText>
                <PremiumBadge>Premium</PremiumBadge>
              </DisabledNavItem>
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
              <ScheduledPublishList>
                {Object.entries(publishState.scheduledPublishes).map(([siteId, scheduledTime]) => {
                  const siteName = publishState.sites.find(s => s.id === siteId)?.name || siteId;
                  return (
                    <ScheduledPublishItem key={siteId}>
                      <ScheduledPublishInfo>
                        <ScheduledPublishSiteId>
                          {siteName}
                        </ScheduledPublishSiteId>
                        <ScheduledPublishTime>
                          {formatScheduledTime(scheduledTime)}
                        </ScheduledPublishTime>
                      </ScheduledPublishInfo>
                      <CancelScheduleButton onClick={() => cancelScheduledPublish(siteId)}>
                        ×
                      </CancelScheduleButton>
                    </ScheduledPublishItem>
                  );
                })}
              </ScheduledPublishList>
            </ScheduledPublishesContainer>
          )}
        </Nav>
        <UserSection>
          {user && !user.user_metadata?.premium && (
            <UpgradeButton onClick={() => setShowUpgradeModal(true)}>
              <UpgradeIcon>✨</UpgradeIcon>
              <UpgradeText>Upgrade to Premium</UpgradeText>
            </UpgradeButton>
          )}
          {user && (
            <LogoutButton onClick={handleLogout}>
              <LogoutIcon>👋</LogoutIcon>
              <LogoutText>Logout</LogoutText>
            </LogoutButton>
          )}
        </UserSection>
        
        {/* Add debug panel at the bottom of sidebar in development */}
        {window.location.hostname === 'localhost' && <ScheduledPublishesDebug />}
      </Sidebar>
      <MainContent>
        {children}
      </MainContent>
      {renderPublishModal()}
      
      <PremiumUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setUpgradeError(null);
        }}
        onUpgrade={handleUpgrade}
        loading={upgradeLoading}
      />
      
      {upgradeError && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          background: 'var(--error-color)',
          color: 'white',
          padding: '1rem',
          borderRadius: '8px',
          zIndex: 1001,
          maxWidth: '300px'
        }}>
          {upgradeError}
          <button 
            onClick={() => setUpgradeError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              marginLeft: '1rem',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}
      
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
  width: 280px;
  background: linear-gradient(180deg, var(--background-light) 0%, rgba(99, 102, 241, 0.02) 100%);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  backdrop-filter: blur(10px);
  border-radius: 0 12px 12px 0;
  overflow: hidden;
`;

const SidebarHeader = styled.div`
  padding: 2rem 1.5rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-light);
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoIcon = styled.div`
  font-size: 1.5rem;
  background: linear-gradient(135deg, var(--primary-color), #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Logo = styled.h1`
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, var(--primary-color), #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Nav = styled.nav`
  flex: 1;
  padding: 1.5rem 0;
`;

const NavItem = styled.div<NavItemProps>`
  margin: 0.25rem 1rem;
  border-radius: 12px;
  transition: all 0.2s ease;
  
  ${props => props.$active && `
    background: linear-gradient(135deg, var(--primary-color), rgba(99, 102, 241, 0.8));
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    
    a, span {
      color: white !important;
    }
  `}
  
  &:hover:not(:has(span[title])) {
    background: var(--hover-color);
    transform: translateX(4px);
  }
`;

const StyledLink = styled(Link)`
  color: var(--text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    text-decoration: none;
    color: var(--primary-color);
  }
`;

const NavIcon = styled.span`
  font-size: 1.2rem;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const NavText = styled.span`
  font-size: 0.95rem;
  font-weight: 500;
`;

const UserSection = styled.div`
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  background: var(--background-light);
`;

const LogoutButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(231, 76, 60, 0.05));
    color: var(--error-color);
    border-color: var(--error-color);
    transform: translateY(-1px);
  }
`;

const LogoutIcon = styled.span`
  font-size: 1.1rem;
`;

const LogoutText = styled.span`
  font-weight: 500;
`;

const UpgradeButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, #ffd700, #ffa500);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s ease;
  margin-bottom: 0.75rem;
  box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);
  
  &:hover {
    background: linear-gradient(135deg, #ffed4e, #ff8f00);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 165, 0, 0.4);
  }
`;

const UpgradeIcon = styled.span`
  font-size: 1.2rem;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
`;

const UpgradeText = styled.span`
  font-weight: 600;
  font-size: 0.9rem;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 2rem;
  margin-left: 280px;
  width: calc(100% - 280px);
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

// Modern styled components for scheduled publishes
interface ScheduledPublishesProps {
  $hasScheduledPublishes: boolean;
}

const ScheduledPublishesContainer = styled.div<ScheduledPublishesProps>`
  margin: 0.75rem;
  padding: 0;
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.03) 0%, 
    rgba(168, 85, 247, 0.03) 100%);
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 100%;
  
  &:hover {
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.08);
    transform: translateY(-1px);
  }
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      #6366f1 0%, 
      #a855f7 50%, 
      #ec4899 100%);
    opacity: ${props => props.$hasScheduledPublishes ? 1 : 0};
    transition: opacity 0.3s ease;
  }
  
  &:after {
    content: '';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    opacity: ${props => props.$hasScheduledPublishes ? 1 : 0};
    animation: ${props => props.$hasScheduledPublishes ? 'pulseGreen 2s infinite' : 'none'};
  }
  
  @keyframes pulseGreen {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }
`;

const ScheduledPublishesTitle = styled.h3<ScheduledPublishesProps>`
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
  padding: 0.75rem 0.75rem 0.5rem 0.75rem;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  
  &:before {
    content: '⏰';
    font-size: 0.875rem;
  }
  
  .dark & {
    color: #f3f4f6;
  }
`;

const ScheduledPublishList = styled.div`
  padding: 0 0.75rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const ScheduledPublishItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  font-size: 0.75rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.7);
    border-color: rgba(99, 102, 241, 0.15);
    transform: translateX(1px);
  }
  
  &:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #6366f1, #a855f7);
    border-radius: 0 2px 2px 0;
  }
  
  .dark & {
    background: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.1);
    
    &:hover {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(99, 102, 241, 0.3);
    }
  }
`;

const ScheduledPublishInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  margin-right: 0.5rem;
  min-width: 0;
`;

const ScheduledPublishSiteId = styled.div`
  font-size: 0.65rem;
  font-weight: 500;
  color: #1f2937;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  .dark & {
    color: #f9fafb;
    background: rgba(99, 102, 241, 0.2);
  }
`;

const ScheduledPublishTime = styled.div`
  font-size: 0.625rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.125rem;
  
  &:before {
    content: '📅';
    font-size: 0.675rem;
  }
  
  .dark & {
    color: #9ca3af;
  }
`;

const CancelScheduleButton = styled.button`
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border: 1px solid #fecaca;
  color: #dc2626;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
  
  &:hover {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    border-color: #f87171;
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  .dark & {
    background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.15));
    border-color: rgba(220, 38, 38, 0.3);
    color: #f87171;
    
    &:hover {
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.15), rgba(220, 38, 38, 0.2));
      border-color: rgba(220, 38, 38, 0.4);
    }
  }
`;

// Modern styled components for publish modal  
const ModernModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModernModalContent = styled.div`
  background: white;
  border-radius: 20px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  .dark & {
    background: #1f2937;
    border-color: rgba(255, 255, 255, 0.1);
  }
`;

const ModernModalHeader = styled.div`
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  
  .dark & {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
`;

const ModernModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ModernModalIcon = styled.div`
  font-size: 1.5rem;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
`;

const ModernModalTitleText = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  
  .dark & {
    color: #f9fafb;
  }
`;

const ModernModalSubtitle = styled.p`
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: #6b7280;
  
  .dark & {
    color: #9ca3af;
  }
`;

const ModernCloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  span {
    font-size: 1.25rem;
    color: #6b7280;
  }
  
  &:hover {
    background: rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }
  
  .dark & {
    background: rgba(255, 255, 255, 0.1);
    
    span {
      color: #d1d5db;
    }
    
    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }
`;

const ModernModalBody = styled.div`
  padding: 0 1.5rem 1rem 1.5rem;
`;

const ModernModalFooter = styled.div`
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  
  .dark & {
    border-top-color: rgba(255, 255, 255, 0.1);
  }
`;

const ModernButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
  justify-content: center;
  
  ${props => props.variant === 'primary' ? `
    background: linear-gradient(135deg, #6366f1, #a855f7);
    color: white;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  ` : `
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
    
    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .dark & {
      background: rgba(255, 255, 255, 0.1);
      color: #d1d5db;
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  `}
`;

const ModernSpinner = styled.div`
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

const ModernSuccessMessage = styled.div`
  padding: 1.5rem;
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
  
  .success-icon {
    font-size: 1.5rem;
  }
  
  .success-text {
    color: #065f46;
    font-weight: 500;
  }
  
  .dark & {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1));
    
    .success-text {
      color: #6ee7b7;
    }
  }
`;

const ModernErrorMessage = styled.div`
  padding: 1rem;
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
  
  .error-icon {
    font-size: 1.25rem;
    margin-top: 0.125rem;
  }
  
  strong {
    color: #dc2626;
  }
  
  p {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
    color: #7f1d1d;
  }
  
  .dark & {
    background: linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(220, 38, 38, 0.1));
    
    strong {
      color: #f87171;
    }
    
    p {
      color: #fca5a5;
    }
  }
`;

const ModernScheduleToggle = styled.div`
  margin: 1.5rem 0;
`;

const ModernToggleLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  position: relative;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
`;



// Additional old styled components for compatibility
const Spinner = styled.div`
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  border-top-color: #6366f1;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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
  background: linear-gradient(135deg, gold, #f39c12);
  color: #fff;
  font-size: 0.7em;
  font-weight: bold;
  border-radius: 8px;
  padding: 0.2em 0.6em;
  margin-left: auto;
  vertical-align: middle;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const DisabledNavItem = styled.span`
  color: var(--text-tertiary);
  opacity: 0.6;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  font-weight: 500;
`;



const ModernSlider = styled.span`
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  background-color: #e5e7eb;
  border-radius: 28px;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 3px;
    top: 3px;
    background-color: white;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  input:checked + & {
    background: linear-gradient(135deg, #6366f1, #a855f7);
  }
  
  input:checked + &:before {
    transform: translateX(20px);
  }
  
  .dark & {
    background-color: #4b5563;
    
    &:before {
      background-color: #f9fafb;
    }
  }
`;

const ModernToggleText = styled.span`
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
`;

const ModernScheduleContainer = styled.div`
  background: var(--background-main);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
`;

const ModernFormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const ModernLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
`;

const ModernDateTimeInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--background-light);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const ModernScheduleSummary = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 6px;
  border-left: 3px solid var(--primary-color);
`;

const ModernQuickOptions = styled.div`
  margin-top: 1rem;
`;

const ModernQuickOptionsButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
`;

const ModernQuickButton = styled.button`
  padding: 0.5rem 1rem;
  background: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    transform: translateY(-1px);
  }
`;

const ModernPublishNote = styled.div`
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 8px;
  border-left: 3px solid var(--primary-color);
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
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