import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      setShowVerificationPanel(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationPanel) {
    return (
      <PageContainer>
        <VerificationContainer>
          <VerificationContent>
            <VerificationIcon>📧</VerificationIcon>
            <VerificationTitle>Check Your Email!</VerificationTitle>
            <VerificationText>
              We just sent you an email with a verification link. Please click the link in your inbox to activate your account.
            </VerificationText>
            <VerificationNote>
              If you don't see the email, check your spam folder.
            </VerificationNote>
            <BackToLoginButton to="/login">Back to Login</BackToLoginButton>
          </VerificationContent>
        </VerificationContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      
      <GridContainer>
        {/* Left Side - Brand & Benefits */}
        <BrandSection>
          <BrandContent>
            <BrandHeader>
              <Logo>⚡ Webflow Manager</Logo>
              <BrandTitle>Join the Revolution</BrandTitle>
              <BrandSubtitle>
                Transform the way you manage Webflow projects. Join thousands of designers and developers who've streamlined their workflow.
              </BrandSubtitle>
            </BrandHeader>
            
            <BenefitsList>
              <Benefit>
                <BenefitIcon>🎯</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Unified Dashboard</BenefitTitle>
                  <BenefitDesc>Manage all your Webflow projects from one place</BenefitDesc>
                </BenefitContent>
              </Benefit>
              
              <Benefit>
                <BenefitIcon>⚡</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Lightning Fast</BenefitTitle>
                  <BenefitDesc>Deploy changes instantly with our optimized pipeline</BenefitDesc>
                </BenefitContent>
              </Benefit>
              
              <Benefit>
                <BenefitIcon>🛡️</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Enterprise Security</BenefitTitle>
                  <BenefitDesc>Bank-level encryption keeps your data safe</BenefitDesc>
                </BenefitContent>
              </Benefit>
              
              <Benefit>
                <BenefitIcon>🚀</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Scale Effortlessly</BenefitTitle>
                  <BenefitDesc>From solo projects to enterprise deployments</BenefitDesc>
                </BenefitContent>
              </Benefit>
            </BenefitsList>
            
            <BrandFooter>
              <TrustBadge>
                <TrustIcon>✨</TrustIcon>
                Free 14-day trial • No credit card required
              </TrustBadge>
            </BrandFooter>
          </BrandContent>
        </BrandSection>

        {/* Right Side - Registration Form */}
        <FormSection>
          <FormContainer>
            <FormHeader>
              <FormTitle>Create Your Account</FormTitle>
              <FormSubtitle>Start your journey with Webflow Manager today</FormSubtitle>
            </FormHeader>
            
            {error && <ErrorMessage>{error}</ErrorMessage>}
            {success && <SuccessMessage>{success}</SuccessMessage>}
            
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                />
                <HelpText>Must be at least 6 characters long</HelpText>
              </FormGroup>
              
              <FormGroup>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </FormGroup>
              
              <SubmitButton type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
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
                Already have an account?{' '}
                <FormLink to="/login">Sign in here</FormLink>
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
    #667eea 0%, 
    var(--primary-color) 50%, 
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
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23dots)"/></svg>');
    opacity: 0.4;
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

const BenefitsList = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-bottom: 3rem;
  
  @media (max-width: 968px) {
    gap: 1rem;
    margin-bottom: 2rem;
  }
`;

const Benefit = styled.div`
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

const BenefitIcon = styled.div`
  font-size: 1.5rem;
  min-width: 40px;
`;

const BenefitContent = styled.div`
  flex: 1;
`;

const BenefitTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
`;

const BenefitDesc = styled.div`
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const TrustIcon = styled.span`
  font-size: 1rem;
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

const HelpText = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
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

const SuccessMessage = styled.div`
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  color: #16a34a;
  font-size: 0.875rem;
  line-height: 1.5;
`;

// Verification Panel Styles
const VerificationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
`;

const VerificationContent = styled.div`
  background: var(--background-light);
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  max-width: 500px;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--border-color);
`;

const VerificationIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1.5rem;
`;

const VerificationTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
`;

const VerificationText = styled.p`
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1rem;
`;

const VerificationNote = styled.p`
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin-bottom: 2rem;
`;

const BackToLoginButton = styled(Link)`
  display: inline-block;
  padding: 0.75rem 2rem;
  background: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  }
`;

export default Register; 