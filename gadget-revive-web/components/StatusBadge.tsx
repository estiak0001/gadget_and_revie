interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'vendor' | 'payment' | 'ticket';
}

export default function StatusBadge({ status, type = 'order' }: StatusBadgeProps) {
  const getStatusStyles = () => {
    const normalizedStatus = status.toLowerCase().replace('_', '-');
    
    switch (type) {
      case 'order':
        switch (normalizedStatus) {
          case 'pending':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'confirmed':
            return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'in-progress':
            return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'completed':
            return 'bg-green-100 text-green-800 border-green-200';
          case 'cancelled':
            return 'bg-red-100 text-red-800 border-red-200';
          case 'rejected':
            return 'bg-red-100 text-red-800 border-red-200';
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      
      case 'vendor':
        switch (normalizedStatus) {
          case 'pending':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'approved':
            return 'bg-green-100 text-green-800 border-green-200';
          case 'rejected':
            return 'bg-red-100 text-red-800 border-red-200';
          case 'info-requested':
            return 'bg-blue-100 text-blue-800 border-blue-200';
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      
      case 'payment':
        switch (normalizedStatus) {
          case 'pending':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'paid':
            return 'bg-green-100 text-green-800 border-green-200';
          case 'failed':
            return 'bg-red-100 text-red-800 border-red-200';
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      
      case 'ticket':
        switch (normalizedStatus) {
          case 'open':
            return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'in-progress':
            return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'resolved':
            return 'bg-green-100 text-green-800 border-green-200';
          case 'closed':
            return 'bg-gray-100 text-gray-800 border-gray-200';
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles()}`}>
      {formatStatus(status)}
    </span>
  );
}
