import { useEffect, useState } from 'react';
import { MainControlPage } from './pages/MainControlPage';
import { FloatingButtonPage } from './pages/FloatingButtonPage';
import { ChatDrawerPage } from './pages/ChatDrawerPage';

function App() {
  const [currentPage, setCurrentPage] = useState<string>('');

  useEffect(() => {
    // Determine which page to show based on URL hash
    const hash = window.location.hash.replace('#/', '');
    setCurrentPage(hash || 'control-panel');

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#/', '');
      setCurrentPage(newHash || 'control-panel');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route to the appropriate page
  if (currentPage === 'control-panel') {
    return <MainControlPage />;
  }

  if (currentPage === 'floating-button') {
    return (
      <div className="w-screen h-screen bg-transparent">
        <FloatingButtonPage />
      </div>
    );
  }

  if (currentPage === 'chat-drawer') {
    return (
      <div className="w-screen h-screen bg-transparent">
        <ChatDrawerPage />
      </div>
    );
  }

  // Default fallback
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Unknown page: {currentPage}</p>
    </div>
  );
}

export default App;
