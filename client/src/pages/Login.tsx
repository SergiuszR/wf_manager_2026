import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, loading, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
      <ThemeToggle onClick={toggleTheme}>
        {theme === 'light' ? '🌙' : '☀️'}
      </ThemeToggle>
      <FormContainer>
        <FormHeader>
          <FormTitle>Login to Your Account</FormTitle>
          <FormSubtitle>Enter your email and password to access your dashboard</FormSubtitle>
        </FormHeader>
        {(localError || error) && <ErrorMessage>{localError || error}</ErrorMessage>}
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="email">Email</Label>
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
            {loading ? 'Logging in...' : 'Log In'}
          </SubmitButton>
        </Form>
        <FormFooter>
          Don't have an account? <FormLink to="/register">Register</FormLink>
        </FormFooter>
      </FormContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--background-main);
  padding: 2rem;
  position: relative;
`;

const ThemeToggle = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--background-light);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s ease;
  box-shadow: var(--box-shadow);
  
  &:hover {
    transform: scale(1.05);
    border-color: var(--primary-color);
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 480px;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  overflow: hidden;
`;

const FormHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
`;

const FormTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
`;

const FormSubtitle = styled.p`
  font-size: 0.875rem;
  margin: 0;
  color: var(--text-secondary);
`;

const Form = styled.form`
  padding: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
`;

const Input = styled.input`
  width: -webkit-fill-available;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 1rem;
  background-color: var(--background-light);
  color: var(--text-primary);
  
  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
  }
`;

const HelpText = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-size: 1rem;
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

const ErrorMessage = styled.div`
  margin: 1.5rem;
  padding: 0.75rem;
  background-color: rgba(229, 62, 62, 0.1);
  border-left: 4px solid var(--error-color);
  color: var(--error-color);
  font-size: 0.875rem;
`;

const InfoSection = styled.div`
  padding: 1.5rem;
  background-color: var(--secondary-color);
  border-top: 1px solid var(--border-color);
`;

const InfoTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--text-primary);
`;

const InfoContent = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  
  ol {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
`;

const InfoNote = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
`;

const InfoLink = styled.a`
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const FormFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
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

export default Login; 