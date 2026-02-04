import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [folders, setFolders] = useState<string[]>([]);

  useEffect(() => {
    // Test IPC connection on mount
    async function testConnection() {
      try {
        const pong = await window.api.ping();
        if (pong === 'pong') {
          setStatus('Connected to Electron main process');
        }

        // Get list of common folders
        const folderList = await window.api.getFolderList();
        setFolders(folderList);
      } catch (error) {
        setStatus('Failed to connect to main process');
        console.error('IPC error:', error);
      }
    }

    testConnection();
  }, []);

  const handleScanFolder = async (folderPath: string) => {
    setStatus(`Scanning ${folderPath}...`);
    const result = await window.api.scanFolder(folderPath, false);
    if (result.success && result.files) {
      setStatus(`Found ${result.files.length} files in ${folderPath}`);
    } else {
      setStatus(`Error: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Backtrack
        </h1>
        <p className="text-gray-600 mb-8">
          AI-Powered File Organization
        </p>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            System Status
          </h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status.includes('Connected') ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-gray-700">{status}</span>
          </div>
        </div>

        {folders.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Available Folders
            </h2>
            <div className="space-y-2">
              {folders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => handleScanFolder(folder)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 font-mono text-sm"
                >
                  {folder}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-400 text-sm mt-8">
          Day 1 - Electron + React + TypeScript Setup Complete
        </p>
      </div>
    </div>
  );
}

export default App;
