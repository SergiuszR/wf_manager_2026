import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useProjectContext } from '../contexts/ProjectContext';
import { FiStar, FiStar as StarIcon, FiSearch, FiPlus, FiX } from 'react-icons/fi';
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

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
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

  return (
    <DashboardContainer>
      <Header>
        <div>
          <Title>Welcome, {user?.email}{user?.user_metadata?.premium && (
            <PremiumBadge>Premium</PremiumBadge>
          )}</Title>
          {user?.id && <UserIdText>User ID: {user.id}</UserIdText>}
        </div>
        <LogoutButton onClick={logout}>Log Out</LogoutButton>
      </Header>
      <SectionTitle>Your Webflow Projects</SectionTitle>
      <TopBar>
        <AddButton onClick={() => setShowAddModal(true)}><FiPlus /> Add Project</AddButton>
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
      </TopBar>
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
      <ProjectGrid>
        {filteredProjects.length === 0 && (
          <EmptyState>
            <EmptyIcon>📂</EmptyIcon>
            <div>No projects found. Try adding or searching above.</div>
          </EmptyState>
        )}
        {filteredProjects.map(p => {
          const isSelected = !!(selectedProject && selectedProject.id === p.id);
          const maskedToken = p.token.length > 8
            ? `${p.token.slice(0, 4)}••••••••${p.token.slice(-4)}`
            : '••••••••';
          const isFavorite = !!favorites[p.id];
          return (
            <ProjectCard
              key={p.id}
              $selected={isSelected}
              onClick={() => setSelectedProject(p)}
              tabIndex={0}
              title={isSelected ? 'Selected project' : 'Click to select'}
            >
              <StarButton
                $active={isFavorite}
                onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}
                title={isFavorite ? 'Unfavorite' : 'Mark as favorite'}
              >
                <FiStar />
              </StarButton>
              <ProjectAvatar>{p.name?.[0]?.toUpperCase() || '?'}</ProjectAvatar>
              <ProjectInfo>
                <ProjectName>{p.name}</ProjectName>
                <ProjectTokenRow>
                  <ProjectToken>
                    {revealedTokenId === p.id ? p.token : maskedToken}
                  </ProjectToken>
                  <ShowHideButton
                    type="button"
                    onClick={e => { e.stopPropagation(); setRevealedTokenId(revealedTokenId === p.id ? null : p.id); }}
                    tabIndex={-1}
                  >
                    {revealedTokenId === p.id ? 'Hide' : 'Show'}
                  </ShowHideButton>
                </ProjectTokenRow>
              </ProjectInfo>
              <ProjectActions>
                {isSelected && <SelectedMark>✓</SelectedMark>}
                <DeleteButton
                  type="button"
                  title="Delete project"
                  onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                >
                  🗑
                </DeleteButton>
              </ProjectActions>
            </ProjectCard>
          );
        })}
      </ProjectGrid>
      {!hasProjects && <div style={{ marginTop: 24, color: 'var(--text-secondary)' }}>Add your first project to unlock Pages, Collections, and Assets features.</div>}
    </DashboardContainer>
  );
};

// Styled components
const DashboardContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

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

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
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