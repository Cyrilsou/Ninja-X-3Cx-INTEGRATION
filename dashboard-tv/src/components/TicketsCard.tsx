import React from 'react';
import { TicketIcon } from '@heroicons/react/24/outline';

interface TicketsCardProps {
  data?: {
    ticketsCreated: number;
    ticketsToday: number;
    avgSentiment: number;
    topCategories: Array<{
      category: string;
      count: number;
    }>;
  };
}

const TicketsCard: React.FC<TicketsCardProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="card">
      <h2 className="card-header flex items-center gap-2">
        <TicketIcon className="h-6 w-6 text-purple-500" />
        Tickets NinjaOne
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <div className="stat-value text-purple-500">{data.ticketsToday}</div>
          <div className="stat-label">Aujourd'hui</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-gray-400">{data.ticketsCreated}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-2">Top catégories</div>
        <div className="space-y-2">
          {data.topCategories.slice(0, 5).map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-300 truncate flex-1">
                {category.category || 'Non classé'}
              </span>
              <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs font-medium ml-2">
                {category.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TicketsCard;