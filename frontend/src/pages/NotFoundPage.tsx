import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { HelpCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4 animate-fade-in">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 mb-6">
        <HelpCircle className="h-8 w-8" />
      </div>
      
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white sm:text-5xl">
        Page Not Found
      </h1>
      
      <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
        The page you are looking for doesn't exist, has been moved, or you might not have authorization to view it.
      </p>

      <div className="mt-8">
        <Button
          variant="primary"
          onClick={() => navigate('/')}
          className="font-semibold flex items-center gap-1.5"
        >
          <Home className="h-4.5 w-4.5" />
          <span>Go Back Home</span>
        </Button>
      </div>
    </div>
  );
};
export default NotFoundPage;
