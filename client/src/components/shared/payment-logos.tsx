import React from 'react';

const vodafone = '/images/vodafone.png';
const instapay = '/images/Instapay.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}


export function VodafoneCashLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <img src={vodafone} alt="Vodafone Cash" className={`${className} object-contain`} />
  );
}


export function InstaPayLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <img src={instapay} alt="InstaPay" className={`${className} object-contain`} />
  );
}

