import { supabase } from '../lib/supabaseClient';

export type ActivityLogType = 
  | 'update_alt_text'
  | 'edit_cms_item'
  | 'create_cms_item'
  | 'delete_cms_item'
  | 'upload_asset'
  | 'delete_asset'
  | 'publish_site';

export type EntityType = 'asset' | 'cms_item' | 'site';

export interface ActivityLog {
  id: string;
  user_id: string;
  project_id: string;
  action_type: ActivityLogType;
  entity_type: EntityType;
  entity_id: string;
  previous_data: any;
  new_data: any;
  created_at: string;
}

/**
 * Records a user activity in the database
 */
export const recordActivity = async (
  projectId: string,
  actionType: ActivityLogType,
  entityType: EntityType,
  entityId: string,
  previousData?: any,
  newData?: any
): Promise<boolean> => {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Cannot record activity: No authenticated user');
      return false;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id, // Explicitly set the user_id to the current authenticated user
      project_id: projectId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      previous_data: previousData || null,
      new_data: newData || null
    });

    if (error) {
      console.error('Error recording activity:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to record activity:', err);
    return false;
  }
};

/**
 * Retrieves activity logs for a specific project
 */
export const getProjectActivityLogs = async (
  projectId: string,
  limit: number = 50,
  page: number = 1
): Promise<ActivityLog[]> => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }

    return data as ActivityLog[];
  } catch (err) {
    console.error('Failed to fetch activity logs:', err);
    return [];
  }
};

/**
 * Retrieves activity logs for a specific entity
 */
export const getEntityActivityLogs = async (
  entityType: EntityType,
  entityId: string,
  limit: number = 10
): Promise<ActivityLog[]> => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching entity activity logs:', error);
      return [];
    }

    return data as ActivityLog[];
  } catch (err) {
    console.error('Failed to fetch entity activity logs:', err);
    return [];
  }
};

/**
 * Formats the activity log for display
 */
export const formatActivityLog = (log: ActivityLog): string => {
  const date = new Date(log.created_at).toLocaleString();
  let action = log.action_type.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  action = action
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  let entityName = '';
  
  if (log.entity_type === 'site' && log.action_type === 'publish_site') {
    // Special formatting for publish_site
    const siteName = log.new_data?.siteName || log.entity_id;
    if (log.new_data?.type === 'scheduled') {
      const sched = log.new_data?.scheduledTime ? ` (Scheduled: ${new Date(log.new_data.scheduledTime).toLocaleString()})` : '';
      return `${date} - Scheduled publish for site: "${siteName}"${sched}`;
    } else {
      return `${date} - Published site: "${siteName}"`;
    }
  }
  
  // Default formatting for other types
  if (log.new_data) {
    if (log.entity_type === 'asset') {
      entityName = log.new_data.name || log.new_data.fileName || log.entity_id;
    } else if (log.entity_type === 'cms_item') {
      entityName = log.new_data.name || log.new_data.title || log.entity_id;
    }
  }
  
  let actionDescription = `${action} ${log.entity_type}`;
  if (entityName) {
    actionDescription += `: "${entityName}"`;
  }
  
  return `${date} - ${actionDescription}`;
};

/**
 * Deletes an activity log by its ID
 */
export const deleteActivityLog = async (logId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('id', logId);
    if (error) {
      console.error('Error deleting activity log:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete activity log:', err);
    return false;
  }
}; 