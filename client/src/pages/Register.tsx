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

  return (
    <RegisterContainer>
      {showVerificationPanel ? (
        <VerificationPanel>
          <h2>Check your email!</h2>
          <p>We just sent you an email. Please click the link in your inbox to activate your account.</p>
          <p>If you don't see the email, check your spam folder.</p>
          <BackToLoginLink to="/login">Back to Login</BackToLoginLink>
        </VerificationPanel>
      ) : (
        <RegisterForm onSubmit={handleSubmit}>
          <LogoContainer>
            <AppLogo>Webflow Manager</AppLogo>
            <AppTagline>Securely manage your Webflow projects</AppTagline>
          </LogoContainer>
          <FormTitle>Create an Account</FormTitle>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && <SuccessMessage>{success}</SuccessMessage>}
          <FormGroup>
            <FormLabel htmlFor="email">Email</FormLabel>
            <FormInput
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup>
            <FormLabel htmlFor="password">Password</FormLabel>
            <FormInput
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup>
            <FormLabel htmlFor="confirmPassword">Confirm Password</FormLabel>
            <FormInput
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </FormGroup>
          <SubmitButton type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </SubmitButton>
          <FormFooter>
            Already have an account? <FormLink to="/login">Log In</FormLink>
          </FormFooter>
        </RegisterForm>
      )}
    </RegisterContainer>
  );
};

// Styled components
const RegisterContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--background-dark);
`;

const RegisterForm = styled.form`
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const AppLogo = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
`;

const AppTagline = styled.p`
  color: var(--text-light);
  font-size: 0.875rem;
`;

const FormTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
`;

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

const SubmitButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 1.5rem;
  
  &:hover {
    background-color: var(--primary-hover);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const FormFooter = styled.div`
  padding: 1.5rem 0 0 0;
  text-align: center;
`;

const FormLink = styled(Link)`
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  background-color: rgba(229, 62, 62, 0.1);
  border-radius: var(--border-radius);
  padding: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
`;

const SuccessMessage = styled.div`
  color: var(--success-color);
  background: rgba(72, 187, 120, 0.1);
  padding: 0.75rem 1rem;
  border-radius: var(--border-radius);
  margin-bottom: 1rem;
  text-align: center;
`;

const VerificationPanel = styled.div`
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  text-align: center;
`;

const BackToLoginLink = styled(Link)`
  display: inline-block;
  margin-top: 1.5rem;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`;

export default Register; 