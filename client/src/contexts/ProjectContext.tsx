import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { Project } from '../pages/Dashboard';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) {
      setProjects(data || []);
      // Do not auto-select a project. Only setSelectedProject(null) if the current selection is not in the new list.
      setSelectedProject(prev => {
        if (!data) return null;
        if (prev && data.find(p => p.id === prev.id)) return prev;
        return null;
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Reset selection if user logs out
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setSelectedProject(null);
    }
  }, [user]);

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, setSelectedProject, refreshProjects: fetchProjects, loading }}>
      {children}
    </ProjectContext.Provider>
  );
};

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within a ProjectProvider');
  return ctx;
} 