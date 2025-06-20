import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useProjectContext } from '../contexts/ProjectContext';
import { PremiumUpgradeModal } from '../components/PremiumUpgradeModal';
import { FiStar, FiStar as StarIcon, FiSearch, FiPlus, FiX, FiUsers, FiFolder, FiActivity, FiTrendingUp, FiEdit3, FiDatabase, FiImage, FiSettings } from 'react-icons/fi';
import { 
  TopBar, AddButton, SearchBar, SearchInput, SortSelect, ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton, StarButton, ModalBody 
} from '../components/ui/WebflowStyledComponents';

export interface Project {
  id: string;
  name: string;
  token: string;
  created_at: string;
  favorite?: boolean;
}

const ADMIN_EMAIL = 'sergiuszrozycki@icloud.com';

// Enhanced styled components for modern dashboard
const DashboardContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

const HeroSection = styled.div`
  background: linear-gradient(135deg, var(--primary-color) 0%, #6366f1 100%);
  border-radius: 16px;
  padding: 2.5rem;
  margin-bottom: 2rem;
  color: white;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    border-radius: 50%;
    transform: translate(50%, -50%);
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
`;

const WelcomeTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  line-height: 1.2;
`;

const WelcomeSubtitle = styled.p`
  font-size: 1.1rem;
  opacity: 0.9;
  margin-bottom: 1.5rem;
  max-width: 600px;
`;

const QuickActions = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const QuickActionButton = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
  }
`;

const StatsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
`;

const ProjectsContainer = styled.div`
  background: var(--background-light);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
`;

const ProjectsHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-main);
`;

const ProjectsContent = styled.div`
  padding: 1.5rem;
`;

const ModernTopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const SearchAndSort = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
`;

const ModernProjectGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
`;

const ModernProjectCard = styled.div<{ $selected?: boolean }>`
  background: var(--background-main);
  border-radius: 12px;
  border: 2px solid ${p => p.$selected ? 'var(--primary-color)' : 'var(--border-color)'};
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  
  &:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
  
  ${p => p.$selected && `
    box-shadow: 0 0 0 3px var(--primary-color-light, #b3d4fc);
  `}
`;

const ProjectCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const ModernProjectAvatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--primary-color) 0%, #6366f1 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
`;

const ProjectMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModernProjectName = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
`;

const ProjectDate = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
`;

const ModernProjectToken = styled.div`
  background: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'SF Mono', monospace;
  font-size: 0.875rem;
  color: var(--text-tertiary);
  word-break: break-all;
  position: relative;
`;

const TokenToggle = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 500;
`;

const ModernProjectActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
`;

const SelectedBadge = styled.div`
  background: var(--primary-color);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ModernStarButton = styled.button<{ $active?: boolean }>`
  background: ${p => p.$active ? 'gold' : 'var(--background-light)'};
  color: ${p => p.$active ? 'white' : 'var(--text-secondary)'};
  border: 1px solid ${p => p.$active ? 'gold' : 'var(--border-color)'};
  border-radius: 6px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: ${p => p.$active ? 'gold' : 'var(--hover-color)'};
  }
`;

const ModernDeleteButton = styled.button`
  background: var(--background-light);
  color: var(--error-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: var(--error-color);
    color: white;
    border-color: var(--error-color);
  }
`;

const EmptyDashboard = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  background: var(--background-light);
  border-radius: 12px;
  border: 2px dashed var(--border-color);
`;

const ModernEmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
`;

const EmptyDescription = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 2rem;
`;

const GetStartedButton = styled.button`
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: var(--hover-color);
    transform: translateY(-1px);
  }
`;

// Keep existing styled components that are still used
const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  color: var(--text-primary);
`;

const ShowHideButton = styled.button`
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.675rem;
  margin-left: 0.5rem;
  cursor: pointer;
  padding: 0 0.25rem;
`;

const SubmitButton = styled.button`
  background-color: var(--primary-color);
  color: white;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background-color: var(--hover-color);
  }
  &:disabled {
    background-color: var(--disabled-color);
    cursor: not-allowed;
  }
`;

const FormHelper = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
`;

const ErrorMessage = styled.p`
  color: var(--error-color);
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const UserIdText = styled.div`
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
  word-break: break-all;
`;

const PremiumBadge = styled.span`
  background: gold;
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  border-radius: 8px;
  padding: 0.2em 0.7em;
  margin-left: 0.5em;
  vertical-align: middle;
`;

const AdminBadge = styled.span`
  background: #2370b8;
  color: #fff;
  font-size: 0.75rem;
  font-weight: bold;
  border-radius: 8px;
  padding: 0.2em 0.7em;
  margin-left: 0.5em;
  vertical-align: middle;
`;

const UserTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 2rem;
  th, td {
    border: 1px solid var(--border-color);
    padding: 0.75em 1em;
    text-align: left;
  }
  th {
    background: var(--background-light);
    font-weight: 600;
  }
`;

const LogoutButton = styled.button`
  background-color: var(--primary-color);
  color: white;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

const DashboardPremiumBadge = styled.span`
  background: linear-gradient(135deg, gold, #f39c12);
  color: #fff;
  font-size: 0.8rem;
  font-weight: bold;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  margin-left: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3);
  animation: glow 2s ease-in-out infinite alternate;
  
  @keyframes glow {
    from { box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3); }
    to { box-shadow: 0 6px 20px rgba(243, 156, 18, 0.5); }
  }
`;

const UserStatusBadge = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
  color: var(--primary-color);
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const UpgradePrompt = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  color: #f39c12;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  span {
    font-size: 1.2rem;
  }
`;

const Dashboard: React.FC = () => {
  const { user, logout, token: authToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Admin user management state
  const [users, setUsers] = useState<{ id: string; email: string; premium: boolean }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const { selectedProject, setSelectedProject, refreshProjects } = useProjectContext();

  // --- Regular user dashboard redesign ---
  const [showTokenId, setShowTokenId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'favorite' | 'name' | 'created_at'>('favorite');
  const [favorites, setFavorites] = useState<{ [id: string]: boolean }>({});
  const [revealedTokenId, setRevealedTokenId] = useState<string | null>(null);
  
  // Premium upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Filter and sort projects
  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'favorite') {
        const favA = favorites[a.id] ? 1 : 0;
        const favB = favorites[b.id] ? 1 : 0;
        if (favA !== favB) return favB - favA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  const toggleFavorite = async (id: string) => {
    const newValue = !favorites[id];
    setFavorites(favs => ({ ...favs, [id]: newValue }));
    // Persist favorite status in DB
    await supabase
      .from('projects')
      .update({ favorite: newValue })
      .eq('id', id)
      .eq('user_id', user?.id);
    // Optionally, refresh projects from DB
    fetchProjects();
  };

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setProjects(data || []);
      // Initialize favorites from DB
      const favs: { [id: string]: boolean } = {};
      (data || []).forEach((p: any) => {
        favs[p.id] = !!p.favorite;
      });
      setFavorites(favs);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, [user]);

  // Check for upgrade success on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (urlParams.get('upgrade') === 'success' && sessionId) {
      // Check payment status and upgrade user
      fetch(`/api/auth/upgrade-premium?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('🎉 Welcome to Premium! Your account has been upgraded successfully.');
            window.location.replace('/dashboard'); // Remove query params and refresh
          } else {
            setUpgradeError('Payment verification failed. Please contact support.');
            window.history.replaceState({}, '', '/dashboard');
          }
        })
        .catch(err => {
          setUpgradeError('Failed to verify payment. Please contact support.');
          window.history.replaceState({}, '', '/dashboard');
        });
    } else if (urlParams.get('upgrade') === 'cancelled') {
      // Clean up URL and show message
      window.history.replaceState({}, '', '/dashboard');
      setUpgradeError('Payment was cancelled. You can try again anytime.');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    setErrorUsers(null);
    fetch('/api/auth/admin/users', {
      headers: { 'x-admin-email': ADMIN_EMAIL }
    })
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || []);
        setLoadingUsers(false);
      })
      .catch(err => {
        setErrorUsers('Failed to load users');
        setLoadingUsers(false);
      });
  }, [isAdmin]);

  const handleTogglePremium = async (id: string, premium: boolean) => {
    setToggling(id);
    setErrorUsers(null);
    try {
      const res = await fetch(`/api/auth/admin/users/${id}/premium`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_EMAIL
        },
        body: JSON.stringify({ premium })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setUsers(users => users.map(u => u.id === id ? { ...u, premium: data.premium } : u));
    } catch (err) {
      setErrorUsers('Failed to update user');
    } finally {
      setToggling(null);
    }
  };

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !token) {
      setError('Please provide both a name and a token');
      return;
    }
    if (token.length < 30) {
      setError('Invalid token format. Webflow API tokens are typically longer than 30 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('projects').insert([{ name, token, user_id: user?.id }]).select();
    if (error) setError(error.message);
    else {
      setName('');
      setToken('');
      await refreshProjects();
      if (data && data[0]) setSelectedProject(data[0]);
      fetchProjects();
    }
    setLoading(false);
  };

  const deleteProject = async (id: string) => {
    setLoading(true);
    await supabase.from('projects').delete().eq('id', id);
    fetchProjects();
    setLoading(false);
  };

  const hasProjects = projects.length > 0;

  if (isAdmin) {
    return (
      <DashboardContainer>
        <Header>
          <div>
            <Title>Welcome, {user?.email} <AdminBadge>Admin</AdminBadge></Title>
          </div>
          <LogoutButton onClick={logout}>Log Out</LogoutButton>
        </Header>
        <SectionTitle>User Management</SectionTitle>
        {loadingUsers ? (
          <div>Loading users...</div>
        ) : errorUsers ? (
          <ErrorMessage>{errorUsers}</ErrorMessage>
        ) : (
          <UserTable>
            <thead>
              <tr>
                <th>Email</th>
                <th>Premium</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.premium ? <PremiumBadge>Premium</PremiumBadge> : '-'}</td>
                  <td>
                    <button
                      onClick={() => handleTogglePremium(u.id, !u.premium)}
                      disabled={toggling === u.id}
                      style={{ padding: '0.3em 1em', borderRadius: 6, background: u.premium ? '#eee' : '#2370b8', color: u.premium ? '#333' : '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      {toggling === u.id ? 'Saving...' : u.premium ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </UserTable>
        )}
      </DashboardContainer>
    );
  }

  // Calculate stats for the dashboard
  const totalProjects = projects.length;
  const favoriteProjects = Object.values(favorites).filter(Boolean).length;
  const recentProjects = projects.filter(p => {
    const created = new Date(p.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created > weekAgo;
  }).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleUpgrade = async () => {
    if (!authToken) {
      setUpgradeError('Authentication required');
      return;
    }

    setUpgradeLoading(true);
    setUpgradeError(null);

    try {
      const response = await fetch('/api/auth/upgrade-premium', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
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

  return (
    <DashboardContainer>
      {/* Hero Section */}
      <HeroSection>
        <HeroContent>
          <WelcomeTitle>
            Welcome back, {user?.email?.split('@')[0]}! 👋
            {user?.user_metadata?.premium && <DashboardPremiumBadge>✨ Premium</DashboardPremiumBadge>}
          </WelcomeTitle>
          <WelcomeSubtitle>
            Ready to manage your Webflow projects? Access your CMS, publish sites, and organize your content all in one place.
            {!user?.user_metadata?.premium && (
              <UpgradePrompt onClick={() => setShowUpgradeModal(true)} style={{ cursor: 'pointer' }}>
                <span>💎</span>
                Upgrade to Premium for advanced features like Asset Management and Activity Logs!
              </UpgradePrompt>
            )}
          </WelcomeSubtitle>
          <QuickActions>
            <QuickActionButton onClick={() => setShowAddModal(true)}>
              <FiPlus /> New Project
            </QuickActionButton>
            {selectedProject && (
              <QuickActionButton as="a" href="/pages">
                <FiEdit3 /> Edit Pages
              </QuickActionButton>
            )}
            {selectedProject && (
              <QuickActionButton as="a" href="/cms-editor">
                <FiDatabase /> Manage CMS
              </QuickActionButton>
            )}
            {user?.user_metadata?.premium && selectedProject && (
              <QuickActionButton as="a" href="/assets">
                <FiImage /> Assets
              </QuickActionButton>
            )}
          </QuickActions>
        </HeroContent>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user?.user_metadata?.premium && (
            <UserStatusBadge>
              ✨ Premium User
            </UserStatusBadge>
          )}
          <LogoutButton onClick={logout}>Log Out</LogoutButton>
        </div>
      </HeroSection>

      {/* Stats Section */}
      <StatsSection>
        <StatCard>
          <StatIcon $color="var(--primary-color)">
            <FiFolder />
          </StatIcon>
          <StatValue>{totalProjects}</StatValue>
          <StatLabel>Total Projects</StatLabel>
        </StatCard>
        <StatCard>
          <StatIcon $color="gold">
            <FiStar />
          </StatIcon>
          <StatValue>{favoriteProjects}</StatValue>
          <StatLabel>Favorites</StatLabel>
        </StatCard>
        <StatCard>
          <StatIcon $color="#10b981">
            <FiTrendingUp />
          </StatIcon>
          <StatValue>{recentProjects}</StatValue>
          <StatLabel>Added This Week</StatLabel>
        </StatCard>
        <StatCard>
          <StatIcon $color="#6366f1">
            <FiUsers />
          </StatIcon>
          <StatValue>{selectedProject ? 'Active' : 'None'}</StatValue>
          <StatLabel>Selected Project</StatLabel>
        </StatCard>
      </StatsSection>

      {/* Projects Section */}
      <ProjectsContainer>
        <ProjectsHeader>
          <SectionHeader>
            <SectionTitle>Your Webflow Projects</SectionTitle>
          </SectionHeader>
          <ModernTopBar>
            <SearchAndSort>
              <SearchBar>
                <FiSearch />
                <SearchInput
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                />
              </SearchBar>
              <SortSelect value={sortBy} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as any)}>
                <option value="favorite">Favorites</option>
                <option value="name">Name</option>
                <option value="created_at">Recently Added</option>
              </SortSelect>
            </SearchAndSort>
            <AddButton onClick={() => setShowAddModal(true)}>
              <FiPlus /> Add Project
            </AddButton>
          </ModernTopBar>
        </ProjectsHeader>

        <ProjectsContent>
          {hasProjects ? (
            <ModernProjectGrid>
              {filteredProjects.map(p => {
                const isSelected = !!(selectedProject && selectedProject.id === p.id);
                const maskedToken = p.token.length > 8
                  ? `${p.token.slice(0, 4)}••••••••${p.token.slice(-4)}`
                  : '••••••••';
                const isFavorite = !!favorites[p.id];
                
                return (
                  <ModernProjectCard
                    key={p.id}
                    $selected={isSelected}
                    onClick={() => setSelectedProject(p)}
                    title={isSelected ? 'Selected project' : 'Click to select'}
                  >
                    <ProjectCardHeader>
                      <ProjectMeta>
                        {isFavorite && (
                          <ModernStarButton
                            $active={true}
                            onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}
                            title="Favorited"
                          >
                            <FiStar />
                          </ModernStarButton>
                        )}
                      </ProjectMeta>
                      <ActionButtons>
                        {!isFavorite && (
                          <ModernStarButton
                            $active={false}
                            onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}
                            title="Add to favorites"
                          >
                            <FiStar />
                          </ModernStarButton>
                        )}
                        <ModernDeleteButton
                          onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                          title="Delete project"
                        >
                          🗑
                        </ModernDeleteButton>
                      </ActionButtons>
                    </ProjectCardHeader>

                    <ModernProjectAvatar>
                      {p.name?.[0]?.toUpperCase() || '?'}
                    </ModernProjectAvatar>

                    <ModernProjectName>{p.name}</ModernProjectName>
                    <ProjectDate>Created {formatDate(p.created_at)}</ProjectDate>

                    <ModernProjectToken>
                      {revealedTokenId === p.id ? p.token : maskedToken}
                      <TokenToggle
                        onClick={e => { 
                          e.stopPropagation(); 
                          setRevealedTokenId(revealedTokenId === p.id ? null : p.id); 
                        }}
                      >
                        {revealedTokenId === p.id ? 'Hide' : 'Show'}
                      </TokenToggle>
                    </ModernProjectToken>

                    <ModernProjectActions>
                      {isSelected ? (
                        <SelectedBadge>Selected</SelectedBadge>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                          Click to select
                        </div>
                      )}
                    </ModernProjectActions>
                  </ModernProjectCard>
                );
              })}
            </ModernProjectGrid>
          ) : (
            <EmptyDashboard>
              <ModernEmptyIcon>🚀</ModernEmptyIcon>
              <EmptyTitle>Ready to Get Started?</EmptyTitle>
              <EmptyDescription>
                Create your first Webflow project to unlock powerful CMS management, 
                one-click publishing, and advanced content organization tools.
              </EmptyDescription>
              <GetStartedButton onClick={() => setShowAddModal(true)}>
                <FiPlus /> Create Your First Project
              </GetStartedButton>
            </EmptyDashboard>
          )}
        </ProjectsContent>
      </ProjectsContainer>

      {/* Add Project Modal */}
      {showAddModal && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Add New Project</ModalTitle>
              <CloseButton onClick={() => setShowAddModal(false)}><FiX /></CloseButton>
            </ModalHeader>
            <ModalBody>
              <Form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { addProject(e); setShowAddModal(false); }}>
                <Input
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Project Name"
                  required
                />
                <Input
                  value={token}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                  placeholder="Webflow Token"
                  required
                  type={showTokenId === 'new' ? 'text' : 'password'}
                  autoComplete="off"
                />
                <ShowHideButton
                  type="button"
                  onClick={() => setShowTokenId(showTokenId === 'new' ? null : 'new')}
                  tabIndex={-1}
                >
                  {showTokenId === 'new' ? 'Hide' : 'Show'}
                </ShowHideButton>
                <SubmitButton type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Project'}
                </SubmitButton>
              </Form>
              <FormHelper>Your Webflow API token is kept private and only used for publishing.</FormHelper>
              {error && <ErrorMessage>{error}</ErrorMessage>}
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}

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
    </DashboardContainer>
  );
};

// Legacy styled components for backward compatibility
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const ProjectGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
`;

const ProjectCard = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  background: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  border: 2px solid ${p => p.$selected ? 'var(--primary-color)' : 'transparent'};
  box-shadow: ${p => p.$selected ? '0 0 0 2px var(--primary-color-light, #b3d4fc)' : 'var(--box-shadow)'};
  transition: border 0.18s, box-shadow 0.18s;
  position: relative;
  &:hover {
    border: 2px solid var(--primary-color-light, #b3d4fc);
  }
`;

const ProjectAvatar = styled.div`
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--secondary-color);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 700;
  margin-right: 1.25rem;
  flex-shrink: 0;
`;

const ProjectInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ProjectTokenRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  max-width: 100%;
`;

const ProjectToken = styled.span`
  font-size: 0.92rem;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
  font-family: 'SFMono-Regular', monospace;
  word-break: break-all;
  max-width: 220px;
  overflow-wrap: anywhere;
  background: var(--background-light);
  padding: 2px 6px;
  border-radius: 4px;
`;

const ProjectName = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
`;

const ProjectActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  margin-left: 1.25rem;
`;

const SelectedMark = styled.span`
  color: var(--primary-color);
  font-size: 1.5rem;
  font-weight: 700;
`;

const EmptyState = styled.div`
  grid-column: 1/-1;
  text-align: center;
  color: var(--text-tertiary);
  font-style: italic;
  padding: 2.5rem 0 1.5rem 0;
`;

const EmptyIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: var(--error-color);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  &:hover {
    text-decoration: underline;
  }
`;

export default Dashboard; 