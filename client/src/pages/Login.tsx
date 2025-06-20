import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, loading, clearError } = useAuth();
  const navigate = useNavigate();
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    }
  };

  return (
    <PageContainer>
      
      <GridContainer>
        {/* Left Side - Brand & Features */}
        <BrandSection>
          <BrandContent>
            <BrandHeader>
              <Logo>⚡ Webflow Manager</Logo>
              <BrandTitle>Streamline Your Webflow Workflow</BrandTitle>
              <BrandSubtitle>
                The ultimate toolkit for managing, editing, and publishing your Webflow projects with ease.
              </BrandSubtitle>
            </BrandHeader>
            
            <FeaturesList>
              <Feature>
                <FeatureIcon>🎨</FeatureIcon>
                <FeatureContent>
                  <FeatureTitle>Visual CMS Editor</FeatureTitle>
                  <FeatureDesc>Edit content with a beautiful, intuitive interface</FeatureDesc>
                </FeatureContent>
              </Feature>
              
              <Feature>
                <FeatureIcon>🚀</FeatureIcon>
                <FeatureContent>
                  <FeatureTitle>One-Click Publishing</FeatureTitle>
                  <FeatureDesc>Deploy your changes instantly to live sites</FeatureDesc>
                </FeatureContent>
              </Feature>
              
              <Feature>
                <FeatureIcon>📊</FeatureIcon>
                <FeatureContent>
                  <FeatureTitle>Advanced Analytics</FeatureTitle>
                  <FeatureDesc>Track performance and get insights</FeatureDesc>
                </FeatureContent>
              </Feature>
              
              <Feature>
                <FeatureIcon>🔐</FeatureIcon>
                <FeatureContent>
                  <FeatureTitle>Secure & Reliable</FeatureTitle>
                  <FeatureDesc>Enterprise-grade security for your data</FeatureDesc>
                </FeatureContent>
              </Feature>
            </FeaturesList>
            
            <BrandFooter>
              <TrustBadge>Trusted by 10,000+ designers</TrustBadge>
            </BrandFooter>
          </BrandContent>
        </BrandSection>

        {/* Right Side - Login Form */}
        <FormSection>
          <FormContainer>
            <FormHeader>
              <FormTitle>Welcome Back</FormTitle>
              <FormSubtitle>Sign in to your account to continue</FormSubtitle>
            </FormHeader>
            
            {(localError || error) && <ErrorMessage>{localError || error}</ErrorMessage>}
            
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </FormGroup>
              
              <SubmitButton type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </SubmitButton>
            </Form>
            
            <Divider>
              <DividerLine />
              <DividerText>or</DividerText>
              <DividerLine />
            </Divider>
            
            <FormFooter>
              <FooterText>
                New to Webflow Manager?{' '}
                <FormLink to="/register">Create an account</FormLink>
              </FooterText>
            </FormFooter>
          </FormContainer>
        </FormSection>
      </GridContainer>
    </PageContainer>
  );
};

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  background: var(--background-main);
  position: relative;
  overflow: hidden;
`;

const ThemeToggle = styled.button`
  position: fixed;
  top: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--background-light);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.3s ease;
  box-shadow: var(--box-shadow);
  z-index: 100;
  backdrop-filter: blur(10px);
  
  &:hover {
    transform: scale(1.1);
    border-color: var(--primary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  
  @media (max-width: 968px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

const BrandSection = styled.div`
  background: linear-gradient(135deg, 
    var(--primary-color) 0%, 
    #667eea 50%, 
    #764ba2 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
    opacity: 0.3;
  }
  
  @media (max-width: 968px) {
    min-height: 300px;
    padding: 2rem;
  }
`;

const BrandContent = styled.div`
  position: relative;
  z-index: 1;
  color: white;
  text-align: center;
  max-width: 500px;
  
  @media (max-width: 968px) {
    max-width: 400px;
  }
`;

const BrandHeader = styled.div`
  margin-bottom: 3rem;
  
  @media (max-width: 968px) {
    margin-bottom: 2rem;
  }
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  letter-spacing: -0.02em;
`;

const BrandTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
  
  @media (max-width: 968px) {
    font-size: 2rem;
  }
`;

const BrandSubtitle = styled.p`
  font-size: 1.125rem;
  opacity: 0.9;
  line-height: 1.6;
  margin: 0;
  
  @media (max-width: 968px) {
    font-size: 1rem;
  }
`;

const FeaturesList = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-bottom: 3rem;
  
  @media (max-width: 968px) {
    gap: 1rem;
    margin-bottom: 2rem;
  }
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }
`;

const FeatureIcon = styled.div`
  font-size: 1.5rem;
  min-width: 40px;
`;

const FeatureContent = styled.div`
  flex: 1;
`;

const FeatureTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
`;

const FeatureDesc = styled.div`
  opacity: 0.8;
  font-size: 0.85rem;
  line-height: 1.4;
`;

const BrandFooter = styled.div`
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
`;

const TrustBadge = styled.div`
  font-size: 0.875rem;
  opacity: 0.8;
  font-weight: 500;
`;

const FormSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: var(--background-light);
  
  @media (max-width: 968px) {
    padding: 2rem;
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 400px;
`;

const FormHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const FormTitle = styled.h2`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  letter-spacing: -0.02em;
`;

const FormSubtitle = styled.p`
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
  line-height: 1.5;
`;

const Form = styled.form`
  margin-bottom: 2rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--background-light);
  color: var(--text-primary);
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  &::placeholder {
    color: var(--text-tertiary);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

const Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: var(--border-color);
`;

const DividerText = styled.span`
  color: var(--text-tertiary);
  font-size: 0.875rem;
  font-weight: 500;
`;

const FormFooter = styled.div`
  text-align: center;
`;

const FooterText = styled.p`
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
`;

const FormLink = styled(Link)`
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover {
    color: var(--primary-hover);
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  line-height: 1.5;
`;

export default Login; 