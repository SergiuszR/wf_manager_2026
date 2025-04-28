import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { webflowAPI } from '../api/apiClient';

const WebflowToken: React.FC = () => {
  const { user, token } = useAuth();
  const [webflowToken, setWebflowToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check token status if user has a token
    // if (user && user.webflowToken) {
    //   validateToken();
    // }
    // Instead, validate if a token exists in backend/local state
    validateToken();
  }, [user]);

  const validateToken = async () => {
    setLoading(true);
    try {
      const response = await webflowAPI.validateToken();
      
      setTokenStatus(response.data.valid ? 'valid' : 'invalid');
    } catch (err) {
      setTokenStatus('invalid');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!webflowToken) {
      setError('Please enter a Webflow token');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await webflowAPI.saveToken(webflowToken);
      
      setTokenStatus('valid');
      setMessage(response.data.message || 'Webflow token saved successfully');
      setWebflowToken('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save token');
      setTokenStatus('invalid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Webflow Token Management</PageTitle>
        <PageDescription>
          Connect to your Webflow projects by providing an API token. Your token is stored securely
          and all API calls are made through our server to protect your credentials.
        </PageDescription>
      </PageHeader>
      
      {/* {user && user.webflowToken && (
        <StatusCard status={tokenStatus}>
          <StatusTitle>Token Status</StatusTitle>
          <StatusMessage>
            {loading ? 'Validating token...' : 
              tokenStatus === 'valid' ? 'Your Webflow token is valid and active' :
              tokenStatus === 'invalid' ? 'Your Webflow token is invalid or expired' :
              'Token status unknown'}
          </StatusMessage>
        </StatusCard>
      )} */}
      {/* Always show status card for now */}
      <StatusCard status={tokenStatus}>
        <StatusTitle>Token Status</StatusTitle>
        <StatusMessage>
          {loading ? 'Validating token...' : 
            tokenStatus === 'valid' ? 'Your Webflow token is valid and active' :
            tokenStatus === 'invalid' ? 'Your Webflow token is invalid or expired' :
            'Token status unknown'}
        </StatusMessage>
      </StatusCard>
      
      <FormCard>
        <FormTitle>Update Webflow Token</FormTitle>
        
        {message && <SuccessMessage>{message}</SuccessMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <TokenForm onSubmit={handleSubmit}>
          <FormGroup>
            <FormLabel htmlFor="webflowToken">Webflow API Token</FormLabel>
            <FormInput
              id="webflowToken"
              type="password"
              placeholder="Enter your Webflow API token"
              value={webflowToken}
              onChange={(e) => setWebflowToken(e.target.value)}
              required
            />
            <FormHelper>
              You can get an API token from your Webflow account settings.
            </FormHelper>
          </FormGroup>
          
          <SubmitButton type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Token'}
          </SubmitButton>
        </TokenForm>
      </FormCard>
      
      <InfoCard>
        <InfoTitle>How to get a Webflow API Token</InfoTitle>
        <InfoText>
          <ol>
            <InfoListItem>Log in to your Webflow account</InfoListItem>
            <InfoListItem>Navigate to Account Settings</InfoListItem>
            <InfoListItem>Select the "Integrations" tab</InfoListItem>
            <InfoListItem>Under "API Access", generate a new token</InfoListItem>
            <InfoListItem>Copy the token and paste it in the form above</InfoListItem>
          </ol>
        </InfoText>
        <InfoText>
          <strong>Note:</strong> The token is securely stored and all API calls are made through our secure backend.
          Your token is never exposed to the browser or any client-side JavaScript.
        </InfoText>
      </InfoCard>
    </PageContainer>
  );
};

// Styled components
const PageContainer = styled.div`
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1rem;
`;

const PageHeader = styled.div`
  margin-bottom: 2rem;
`;

const PageTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
`;

const PageDescription = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.6;
`;

const StatusCard = styled.div<{ status: 'valid' | 'invalid' | 'unknown' }>`
  padding: 1.5rem;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  margin-bottom: 1.5rem;
  background-color: ${({ status }) => 
    status === 'valid' ? 'rgba(72, 187, 120, 0.1)' :
    status === 'invalid' ? 'rgba(229, 62, 62, 0.1)' :
    'var(--background-light)'};
  border: 1px solid ${({ status }) => 
    status === 'valid' ? 'var(--success-color)' :
    status === 'invalid' ? 'var(--error-color)' :
    'var(--border-color)'};
`;

const StatusTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
`;

const StatusMessage = styled.p`
  font-size: 0.875rem;
`;

const FormCard = styled.div`
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const FormTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
`;

const TokenForm = styled.form``;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const FormLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
`;

const FormInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 1rem;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
`;

const FormHelper = styled.p`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-light);
`;

const SubmitButton = styled.button`
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--primary-hover);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const InfoCard = styled.div`
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 1.5rem;
`;

const InfoTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
`;

const InfoText = styled.div`
  margin-bottom: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.6;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoListItem = styled.li`
  margin-bottom: 0.5rem;
`;

const SuccessMessage = styled.div`
  color: var(--success-color);
  background-color: rgba(72, 187, 120, 0.1);
  border-radius: var(--border-radius);
  padding: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  background-color: rgba(229, 62, 62, 0.1);
  border-radius: var(--border-radius);
  padding: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
`;

export default WebflowToken; 