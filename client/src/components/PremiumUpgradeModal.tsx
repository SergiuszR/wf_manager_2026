import React, { useState } from 'react';
import styled from 'styled-components';
import { FiX, FiCheck, FiStar, FiImage, FiBarChart, FiZap, FiUsers, FiShield } from 'react-icons/fi';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
  loading?: boolean;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background: var(--background-main);
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  border: 1px solid var(--border-color);
  animation: slideUp 0.3s ease-out;
  display: flex;
  flex-direction: column;
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  padding: 2rem;
  text-align: center;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }
`;

const HeaderIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  
  svg {
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }
`;

const HeaderTitle = styled.h2`
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const HeaderSubtitle = styled.p`
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
  font-weight: 400;
`;

const ModalBody = styled.div`
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  max-height: calc(90vh - 120px); /* Account for header height */
`;

const ComparisonTable = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  margin-bottom: 2rem;
`;

const TableHeader = styled.div`
  background: var(--background-light);
  padding: 1.5rem 1rem;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  
  &:nth-child(1) {
    border-right: 1px solid var(--border-color);
  }
  
  &:nth-child(2) {
    border-right: 1px solid var(--border-color);
    text-align: center;
  }
  
  &:nth-child(3) {
    text-align: center;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.1));
    color: #f39c12;
  }
`;

const FeatureRow = styled.div`
  background: var(--background-main);
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  &:nth-child(3n+1) {
    border-right: 1px solid var(--border-color);
  }
  
  &:nth-child(3n+2), &:nth-child(3n) {
    justify-content: center;
    border-right: 1px solid var(--border-color);
  }
  
  &:nth-child(3n) {
    border-right: none;
  }
  
  &:last-child, &:nth-last-child(2), &:nth-last-child(3) {
    border-bottom: none;
  }
`;

const FeatureIcon = styled.div`
  color: var(--primary-color);
  font-size: 1.2rem;
  flex-shrink: 0;
`;

const FeatureName = styled.span`
  color: var(--text-primary);
  font-weight: 500;
`;

const CheckIcon = styled.div<{ available: boolean; premium?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => 
    props.available 
      ? props.premium 
        ? 'linear-gradient(135deg, #ffd700, #ffa500)' 
        : 'var(--primary-color)' 
      : 'var(--disabled-color)'
  };
  color: white;
  font-size: 0.8rem;
  
  svg {
    stroke-width: 3;
  }
`;

const CrossIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--disabled-color);
  color: white;
  font-size: 0.8rem;
`;

const PricingSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
`;

const PricingCard = styled.div<{ premium?: boolean }>`
  padding: 2rem;
  border-radius: 16px;
  border: 2px solid ${props => props.premium ? 'gold' : 'var(--border-color)'};
  background: ${props => 
    props.premium 
      ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(255, 165, 0, 0.05))' 
      : 'var(--background-light)'
  };
  text-align: center;
  position: relative;
  
  ${props => props.premium && `
    &:before {
      content: "Most Popular";
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, gold, #ffa500);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);
    }
  `}
`;

const PricingTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: var(--text-primary);
`;

const PricingPrice = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 1rem;
  
  span {
    font-size: 1rem;
    color: var(--text-secondary);
    font-weight: 400;
  }
`;

const UpgradeButton = styled.button<{ loading?: boolean }>`
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  ${props => props.loading && `
    &:after {
      content: "";
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `}
`;

const CurrentPlanBadge = styled.div`
  background: var(--disabled-color);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  width: 100%;
  text-align: center;
`;

const features = [
  { name: 'Webflow CMS Management', icon: <FiUsers />, free: true, premium: true },
  { name: 'Page Publishing', icon: <FiZap />, free: true, premium: true },
  { name: 'Project Management', icon: <FiShield />, free: true, premium: true },
  { name: 'Basic Support', icon: <FiCheck />, free: true, premium: true },
  { name: 'Asset Management', icon: <FiImage />, free: false, premium: true },
  { name: 'Activity Logs & Analytics', icon: <FiBarChart />, free: false, premium: true },
  { name: 'Advanced Publishing Options', icon: <FiZap />, free: false, premium: true },
  { name: 'Priority Support', icon: <FiShield />, free: false, premium: true },
  { name: 'Bulk Operations', icon: <FiUsers />, free: false, premium: true },
  { name: 'Advanced Integrations', icon: <FiStar />, free: false, premium: true },
];

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  loading = false
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <CloseButton onClick={onClose}>
            <FiX />
          </CloseButton>
          <HeaderIcon>
            <FiStar />
          </HeaderIcon>
          <HeaderTitle>Upgrade to Premium</HeaderTitle>
          <HeaderSubtitle>
            Unlock powerful features to supercharge your Webflow workflow
          </HeaderSubtitle>
        </ModalHeader>

        <ModalBody>
          <ComparisonTable>
            <TableHeader>Features</TableHeader>
            <TableHeader>Free</TableHeader>
            <TableHeader>Premium ✨</TableHeader>
            
            {features.map((feature, index) => (
              <React.Fragment key={index}>
                <FeatureRow>
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                  <FeatureName>{feature.name}</FeatureName>
                </FeatureRow>
                <FeatureRow>
                  {feature.free ? (
                    <CheckIcon available={true}>
                      <FiCheck />
                    </CheckIcon>
                  ) : (
                    <CrossIcon>×</CrossIcon>
                  )}
                </FeatureRow>
                <FeatureRow>
                  <CheckIcon available={true} premium={true}>
                    <FiCheck />
                  </CheckIcon>
                </FeatureRow>
              </React.Fragment>
            ))}
          </ComparisonTable>

          <PricingSection>
            <PricingCard>
              <PricingTitle>Free</PricingTitle>
              <PricingPrice>
                $0 <span>/month</span>
              </PricingPrice>
              <CurrentPlanBadge>Current Plan</CurrentPlanBadge>
            </PricingCard>

            <PricingCard premium>
              <PricingTitle>Premium</PricingTitle>
              <PricingPrice>
                $19 <span>/month</span>
              </PricingPrice>
              <UpgradeButton 
                onClick={onUpgrade} 
                disabled={loading}
                loading={loading}
              >
                {loading ? 'Processing...' : (
                  <>
                    <FiStar />
                    Upgrade Now
                  </>
                )}
              </UpgradeButton>
            </PricingCard>
          </PricingSection>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
}; 