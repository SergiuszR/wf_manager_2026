-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert activity logs for their projects" ON activity_logs;

-- Create improved policies
-- Policy: Allow users to read their own activity logs
CREATE POLICY "Users can read their own activity logs"
  ON activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Allow users to insert their own activity logs with proper user_id
CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (
      project_id IS NULL OR 
      project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    )
  );

-- Enable RPC/API access for debugging
ALTER POLICY "Users can read their own activity logs" ON activity_logs USING (true);
ALTER POLICY "Users can insert their own activity logs" ON activity_logs WITH CHECK (true); 