import { DollarSign, Zap, Unlock, Wrench, Check } from 'lucide-react';

interface IconProps {
  name: 'DollarSign' | 'Zap' | 'Unlock' | 'Wrench' | 'Check';
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const iconMap = {
  DollarSign,
  Zap,
  Unlock,
  Wrench,
  Check,
};

export default function Icon({ name, size = 24, strokeWidth = 2, className }: IconProps) {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    return null;
  }

  return <IconComponent size={size} strokeWidth={strokeWidth} className={className} />;
}
