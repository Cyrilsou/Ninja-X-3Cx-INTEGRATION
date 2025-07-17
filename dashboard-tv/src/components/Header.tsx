import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PhoneIcon } from '@heroicons/react/24/solid';

interface HeaderProps {
  currentTime: Date;
}

const Header: React.FC<HeaderProps> = ({ currentTime }) => {
  return (
    <header className="flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <PhoneIcon className="h-12 w-12 text-blue-500" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            3CX-Ninja Dashboard
          </h1>
          <p className="text-gray-400">Monitoring temps réel</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-4xl font-mono">
          {format(currentTime, 'HH:mm:ss')}
        </div>
        <div className="text-xl text-gray-400">
          {format(currentTime, 'EEEE d MMMM yyyy', { locale: fr })}
        </div>
      </div>
    </header>
  );
};

export default Header;